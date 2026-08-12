import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Set your Toss Payments test secret in Supabase Edge Function secrets.
// Never commit a secret key or expose it to browser code.
const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("AUTH_REQUIRED")) return "로그인이 필요합니다.";
  if (message.includes("PRODUCT_NOT_AVAILABLE")) return "현재 구매할 수 없는 상품이 포함되어 있습니다.";
  if (message.includes("INVALID_CART") || message.includes("INVALID_CART_ITEM") || message.includes("INVALID_QUANTITY") || message.includes("DUPLICATE_CART_ITEM")) return "장바구니 정보를 다시 확인해 주세요.";
  if (message.includes("INVALID_CHECKOUT") || message.includes("INVALID_DELIVERY_REQUEST")) return "주문자와 배송지 정보를 다시 확인해 주세요.";
  return "결제 요청을 처리하지 못했습니다.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED", message: "POST 요청만 지원합니다." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "AUTH_REQUIRED", message: "로그인이 필요합니다." }, 401);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "SERVER_CONFIG", message: "결제 서버 설정을 확인해 주세요." }, 500);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "AUTH_REQUIRED", message: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON", message: "잘못된 요청입니다." }, 400);
  }
  if (body.action === "confirm" && !TOSS_SECRET_KEY) {
    return json({ error: "TOSS_CONFIG", message: "토스 테스트 결제 설정을 확인해 주세요." }, 500);
  }

  if (body.action === "prepare") {
    const checkout = (body.checkout ?? {}) as Record<string, unknown>;
    const { data, error } = await userClient.rpc("prepare_toss_order", {
      p_items: body.items,
      p_customer_name: checkout.customerName,
      p_customer_email: checkout.email,
      p_phone: checkout.phone,
      p_postal_code: checkout.postalCode,
      p_address_line1: checkout.addressLine1,
      p_address_line2: checkout.addressLine2,
      p_delivery_request: checkout.deliveryRequest || null,
    }).single();

    if (error || !data) {
      console.error("prepare_toss_order failed", error);
      return json({ error: "PREPARE_FAILED", message: safeMessage(error) }, 400);
    }

    return json({
      orderId: data.toss_order_id,
      orderNumber: data.order_number,
      orderName: data.order_name,
      amount: data.total,
      subtotal: data.subtotal,
      shippingFee: data.shipping_fee,
      testMode: true,
    });
  }

  if (body.action === "confirm") {
    const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
    const tossOrderId = typeof body.orderId === "string" ? body.orderId : "";
    const amount = Number(body.amount);
    if (!paymentKey || !tossOrderId || !Number.isSafeInteger(amount) || amount < 1) {
      return json({ error: "INVALID_CONFIRM", message: "결제 승인 정보가 올바르지 않습니다." }, 400);
    }

    const { data: order, error: orderError } = await userClient
      .from("orders")
      .select("id,order_number,user_id,payment_status,total,toss_order_id,receipt_url")
      .eq("toss_order_id", tossOrderId)
      .maybeSingle();
    if (orderError || !order) return json({ error: "ORDER_NOT_FOUND", message: "주문 정보를 찾지 못했습니다." }, 404);
    if (order.user_id !== user.id) return json({ error: "ORDER_FORBIDDEN", message: "이 주문을 승인할 수 없습니다." }, 403);
    if (Number(order.total) !== amount) return json({ error: "AMOUNT_MISMATCH", message: "주문 금액이 일치하지 않습니다." }, 400);

    if (order.payment_status === "test_paid") {
      return json({
        success: true,
        orderNumber: order.order_number,
        amount: order.total,
        receiptUrl: order.receipt_url,
        testMode: true,
      });
    }
    if (order.payment_status !== "pending") {
      return json({ error: "ORDER_NOT_PAYABLE", message: "이미 처리되었거나 결제할 수 없는 주문입니다." }, 409);
    }

    let tossResponse: Response;
    let tossResult: Record<string, any>;
    try {
      tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TOSS_SECRET_KEY}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount }),
      });
      tossResult = await tossResponse.json();
    } catch (error) {
      console.error("Toss confirm network failure", error);
      return json({ error: "TOSS_UNAVAILABLE", message: "토스페이먼츠 승인 서버에 연결하지 못했습니다." }, 502);
    }

    if (!tossResponse.ok) {
      console.error("Toss confirm rejected", tossResult);
      await adminClient.from("orders").update({ payment_status: "failed" }).eq("id", order.id).eq("payment_status", "pending");
      return json({
        error: tossResult.code ?? "TOSS_CONFIRM_FAILED",
        message: tossResult.message ?? "테스트 결제 승인이 실패했습니다.",
      }, tossResponse.status >= 500 ? 502 : 400);
    }

    if (Number(tossResult.totalAmount) !== amount || tossResult.orderId !== tossOrderId || tossResult.status !== "DONE") {
      console.error("Unexpected Toss result", tossResult);
      return json({ error: "TOSS_RESULT_MISMATCH", message: "토스 결제 결과를 검증하지 못했습니다." }, 502);
    }

    const receiptUrl = tossResult.receipt?.url ?? null;
    const { data: updated, error: updateError } = await adminClient
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "test_paid",
        payment_method: "toss_test",
        payment_key: paymentKey,
        receipt_url: receiptUrl,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select("order_number,total,receipt_url")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("Order finalization failed", updateError);
      return json({ error: "ORDER_FINALIZE_FAILED", message: "결제는 승인됐지만 주문 저장을 완료하지 못했습니다. 고객센터에 문의해 주세요." }, 500);
    }

    const { error: clearCartError } = await adminClient.from("cart_items").delete().eq("user_id", user.id);
    if (clearCartError) console.error("Cart clear failed", clearCartError);

    return json({
      success: true,
      orderNumber: updated.order_number,
      amount: updated.total,
      receiptUrl: updated.receipt_url,
      method: tossResult.method,
      approvedAt: tossResult.approvedAt,
      testMode: true,
    });
  }

  return json({ error: "INVALID_ACTION", message: "지원하지 않는 결제 요청입니다." }, 400);
});
