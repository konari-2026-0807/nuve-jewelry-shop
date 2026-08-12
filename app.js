import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

const categoryInfo = {
  earrings: { label: 'EARRING', material: 'Silver 925 · Surgical steel', description: '얼굴선에 자연스럽게 빛을 더하는 가벼운 데일리 이어링입니다.' },
  necklaces: { label: 'NECKLACE', material: 'Silver 925 · 14K gold plated', description: '단독으로도 레이어드로도 편안하게 어울리는 슬림한 목걸이입니다.' },
  bracelets: { label: 'BRACELET', material: 'Surgical steel · Freshwater pearl', description: '손목을 따라 유연하게 흐르는 섬세한 실루엣의 팔찌입니다.' },
  rings: { label: 'RING', material: 'Silver 925 · Rhodium plated', description: '매일 다른 조합을 즐길 수 있는 편안한 데일리 링입니다.' }
};

const names = {
  earrings: ['라일 미니 후프 귀걸이','오브 슬림 골드 링 귀걸이','듀 포인트 진주 귀걸이','리네 드롭 체인 귀걸이','미오 자개 하트 귀걸이','로프 트위스트 링 귀걸이','쁘띠 데이지 귀걸이','루나 크리스탈 드롭 귀걸이','볼드 오벌 원터치 귀걸이','레이어드 이어커프 세트'],
  necklaces: ['하트 노트 펜던트 목걸이','모브 슬림 바 목걸이','듀 담수 진주 체인 목걸이','오브 베젤 크리스탈 목걸이','에센셜 레이어드 체인','쁘띠 리본 실버 목걸이','아르코 라인 펜던트 목걸이','코스타 쉘 펜던트 목걸이','플로우 스네이크 체인','클로버 미니 펜던트 목걸이'],
  bracelets: ['리네 데일리 체인 팔찌','미오 하트 포인트 팔찌','듀 담수 진주 팔찌','모브 투톤 비즈 팔찌','아르코 슬림 뱅글','루나 테니스 팔찌','코스타 참 체인 팔찌','플로우 페이퍼클립 팔찌','리본 패브릭 브레이슬릿','믹스 투톤 체인 팔찌'],
  rings: ['리네 슬림 실버 링','웨이브 오픈 반지','듀 진주 포인트 링','로프 트위스트 골드 링','오브 볼드 돔 반지','미오 미니 하트 링','루나 크리스탈 라인 링','레이어드 실버 링 세트','아르코 미니 시그넷 링','노트 매듭 포인트 링']
};

const basePrices = {
  earrings: [19000,22000,24000,21000,26000,29000,18000,27000,32000,17000],
  necklaces: [29000,32000,34000,31000,39000,33000,35000,37000,28000,36000],
  bracelets: [22000,25000,29000,24000,27000,35000,32000,26000,19000,33000],
  rings: [17000,19000,21000,22000,25000,18000,24000,29000,23000,20000]
};

const products = Object.keys(names).flatMap((category, categoryIndex) => names[category].map((name, index) => {
  const id = `${category}-${index + 1}`;
  const isSale = [1, 4, 7].includes(index);
  const price = basePrices[category][index];
  return {
    id, name, category, image: index, price,
    originalPrice: isSale ? Math.round(price / .8 / 1000) * 1000 : null,
    badge: index === 0 || index === 6 ? 'NEW' : (index === 1 ? 'BEST' : ''),
    review: 18 + ((categoryIndex + 2) * (index + 7) * 11) % 186,
    order: categoryIndex * 10 + index,
    ...categoryInfo[category]
  };
}));

let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'featured';
const GUEST_CART_KEY = 'nuve_guest_cart_v1';
const GUEST_WISHLIST_KEY = 'nuve_guest_wishlist_v1';
let currentUser = null;
let cart = readGuestCart();
let wishes = new Set(readGuestWishlist());
let selectedProduct = null;

const productGrid = document.querySelector('#product-grid');
const bestGrid = document.querySelector('#best-grid');
const productCount = document.querySelector('#product-count');
const emptyState = document.querySelector('#empty-state');
const toast = document.querySelector('.toast');
const won = value => `${value.toLocaleString('ko-KR')}원`;

function cardTemplate(product) {
  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  return `<article class="product-card" data-product-id="${product.id}">
    <div class="product-image sprite ${product.category} pos-${product.image}">
      ${product.badge ? `<span class="badge">${product.badge}</span>` : ''}
      <button class="product-open" type="button" data-open="${product.id}" aria-label="${product.name} 상세 보기"></button>
      <button class="wish-button ${wishes.has(product.id) ? 'active' : ''}" type="button" data-wish="${product.id}" aria-label="${product.name} 관심상품 ${wishes.has(product.id) ? '삭제' : '저장'}" aria-pressed="${wishes.has(product.id)}">${wishes.has(product.id) ? '&#9829;' : '&#9825;'}</button>
      <button class="quick-add" type="button" data-add="${product.id}">QUICK ADD +</button>
    </div>
    <div class="product-info">
      <div class="product-meta"><span class="product-category">${product.label}</span><span class="review">REVIEW ${product.review}</span></div>
      <h3>${product.name}</h3>
      <div class="price-row">${product.originalPrice ? `<span class="discount">${discount}%</span>` : ''}<strong>${won(product.price)}</strong>${product.originalPrice ? `<span class="original-price">${won(product.originalPrice)}</span>` : ''}</div>
    </div>
  </article>`;
}

function filteredProducts() {
  let result = products.filter(product => {
    const categoryMatch = currentFilter === 'all' || product.category === currentFilter || (currentFilter === 'best' && (product.badge === 'BEST' || product.review > 120)) || (currentFilter === 'new' && product.badge === 'NEW');
    const searchMatch = !currentSearch || `${product.name} ${product.label} ${product.material}`.toLowerCase().includes(currentSearch.toLowerCase());
    return categoryMatch && searchMatch;
  });
  if (currentSort === 'low') result.sort((a,b) => a.price - b.price);
  if (currentSort === 'high') result.sort((a,b) => b.price - a.price);
  if (currentSort === 'new') result.sort((a,b) => (b.badge === 'NEW') - (a.badge === 'NEW') || b.order - a.order);
  return result;
}

function renderProducts() {
  const list = filteredProducts();
  productGrid.innerHTML = list.map(cardTemplate).join('');
  productCount.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === currentFilter));
  document.querySelectorAll('.category-nav [data-category]').forEach(button => button.classList.toggle('active', button.dataset.category === currentFilter));
}

function renderBest() {
  const best = [...products].sort((a,b) => b.review - a.review).slice(0,8);
  bestGrid.innerHTML = best.map(cardTemplate).join('');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function openDrawer(selector) {
  closeDrawers();
  document.querySelector(selector).classList.add('open');
  document.querySelector(selector).setAttribute('aria-hidden', 'false');
  document.querySelector('.drawer-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawers() {
  document.querySelectorAll('.drawer,.mobile-nav').forEach(el => { el.classList.remove('open'); el.setAttribute('aria-hidden','true'); });
  document.querySelector('.drawer-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function readGuestCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(item => products.some(product => product.id === item.id) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

function readGuestWishlist() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(id => products.some(product => product.id === id)) : [];
  } catch {
    return [];
  }
}

function saveGuestWishlist() {
  if (!currentUser) localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify([...wishes]));
}

function saveGuestCart() {
  if (!currentUser) localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

async function saveCartLine(item) {
  if (!currentUser) { saveGuestCart(); return true; }
  const { error } = await supabase.from('cart_items').upsert({
    user_id: currentUser.id,
    product_id: item.id,
    quantity: item.quantity,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,product_id' });
  if (error) { console.error(error); showToast('장바구니 저장에 실패했습니다. 잠시 후 다시 시도해주세요.'); return false; }
  return true;
}

async function deleteCartLine(id) {
  if (!currentUser) { saveGuestCart(); return true; }
  const { error } = await supabase.from('cart_items').delete().eq('user_id', currentUser.id).eq('product_id', id);
  if (error) { console.error(error); showToast('장바구니 변경사항을 저장하지 못했습니다.'); return false; }
  return true;
}

async function loadAccountCart() {
  if (!currentUser) { cart = readGuestCart(); renderCart(); return; }
  const { data, error } = await supabase.from('cart_items').select('product_id,quantity').order('created_at');
  if (error) { console.error(error); showToast('장바구니를 불러오지 못했습니다.'); return; }
  cart = (data || []).filter(item => products.some(product => product.id === item.product_id)).map(item => ({ id: item.product_id, quantity: item.quantity }));
  renderCart();
}

async function mergeGuestCartIntoAccount() {
  const guestCart = readGuestCart();
  if (!guestCart.length || !currentUser) { await loadAccountCart(); return; }
  const { data, error } = await supabase.from('cart_items').select('product_id,quantity');
  if (error) { console.error(error); await loadAccountCart(); return; }
  const merged = new Map((data || []).map(item => [item.product_id, item.quantity]));
  guestCart.forEach(item => merged.set(item.id, Math.min(10, (merged.get(item.id) || 0) + item.quantity)));
  const rows = [...merged].map(([productId, quantity]) => ({ user_id: currentUser.id, product_id: productId, quantity, updated_at: new Date().toISOString() }));
  const { error: upsertError } = await supabase.from('cart_items').upsert(rows, { onConflict: 'user_id,product_id' });
  if (upsertError) { console.error(upsertError); showToast('임시 장바구니를 계정에 합치지 못했습니다.'); }
  else localStorage.removeItem(GUEST_CART_KEY);
  await loadAccountCart();
}

async function addToCart(id) {
  const line = cart.find(item => item.id === id);
  if (line) line.quantity = Math.min(10, line.quantity + 1);
  else cart.push({ id, quantity: 1 });
  const product = products.find(item => item.id === id);
  renderCart();
  await saveCartLine(cart.find(item => item.id === id));
  showToast(`${product.name}을(를) 장바구니에 담았습니다.`);
}

function renderCart() {
  const quantity = cart.reduce((sum,item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = quantity);
  const container = document.querySelector('#cart-items');
  if (!cart.length) container.innerHTML = '<div class="cart-empty"><p>장바구니가 비어 있습니다.</p><small>오늘의 작은 반짝임을 골라보세요.</small></div>';
  else container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    return `<article class="cart-line"><div class="cart-line-image sprite ${product.category} pos-${product.image}"></div><div><h3>${product.name}</h3><p>${won(product.price)}</p><div class="quantity"><button data-quantity="minus" data-id="${product.id}" aria-label="수량 빼기">−</button><span>${item.quantity}</span><button data-quantity="plus" data-id="${product.id}" aria-label="수량 더하기">+</button></div></div><button class="cart-remove" data-remove="${product.id}" aria-label="삭제">×</button></article>`;
  }).join('');
  const total = cart.reduce((sum,item) => sum + products.find(p => p.id === item.id).price * item.quantity, 0);
  document.querySelector('#cart-total').textContent = won(total);
}

const checkoutModal = document.querySelector('#checkout-modal');
const paymentResultModal = document.querySelector('#payment-result-modal');
const postcodeLayer = document.querySelector('#postcode-layer');
const postcodeEmbed = document.querySelector('#postcode-embed');
let postcodeLoader = null;

function renderCheckoutSummary() {
  const container = document.querySelector('#checkout-items');
  container.innerHTML = cart.map(item => {
    const product = products.find(productItem => productItem.id === item.id);
    return `<article class="checkout-line"><div class="checkout-line-image sprite ${product.category} pos-${product.image}"></div><div><h3>${product.name}</h3><p>${won(product.price)} · ${item.quantity}개</p></div><strong>${won(product.price * item.quantity)}</strong></article>`;
  }).join('');
  const subtotal = cart.reduce((sum, item) => sum + products.find(product => product.id === item.id).price * item.quantity, 0);
  const shipping = subtotal >= 50000 ? 0 : 3000;
  document.querySelector('#checkout-subtotal').textContent = won(subtotal);
  document.querySelector('#checkout-shipping').textContent = shipping ? won(shipping) : '무료';
  document.querySelector('#checkout-total').textContent = won(subtotal + shipping);
}

function closePostcodeSearch() {
  postcodeLayer.hidden = true;
  postcodeEmbed.replaceChildren();
}

function loadKakaoPostcode() {
  if (window.kakao?.Postcode) return Promise.resolve();
  if (postcodeLoader) return postcodeLoader;
  postcodeLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = () => window.kakao?.Postcode ? resolve() : reject(new Error('Kakao Postcode unavailable'));
    script.onerror = () => reject(new Error('Kakao Postcode failed to load'));
    document.head.append(script);
  }).catch(error => {
    postcodeLoader = null;
    throw error;
  });
  return postcodeLoader;
}

function applyPostcodeResult(data) {
  const isRoadAddress = data.userSelectedType === 'R';
  const baseAddress = (isRoadAddress ? data.roadAddress : data.jibunAddress) || data.address;
  const extra = [];
  if (isRoadAddress && data.bname && /[동로가]$/.test(data.bname)) extra.push(data.bname);
  if (isRoadAddress && data.buildingName && data.apartment === 'Y') extra.push(data.buildingName);
  document.querySelector('#checkout-postcode').value = data.zonecode;
  document.querySelector('#checkout-address').value = `${baseAddress}${extra.length ? ` (${extra.join(', ')})` : ''}`;
  document.querySelector('#address-guide').textContent = `${isRoadAddress ? '도로명' : '지번'} 주소가 선택되었습니다. 상세주소를 입력해 주세요.`;
  closePostcodeSearch();
  document.querySelector('#checkout-address-detail').focus();
}

async function openPostcodeSearch() {
  const button = document.querySelector('#postcode-search-button');
  button.disabled = true;
  button.textContent = '불러오는 중';
  try {
    await loadKakaoPostcode();
    postcodeEmbed.replaceChildren();
    postcodeLayer.hidden = false;
    new window.kakao.Postcode({
      oncomplete: applyPostcodeResult,
      onresize: size => { postcodeEmbed.style.height = `${Math.min(Math.max(size.height, 420), 560)}px`; },
      width: '100%',
      height: '100%',
      maxSuggestItems: 5,
      autoClose: false
    }).embed(postcodeEmbed);
    postcodeLayer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    showToast('주소 검색 서비스를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  } finally {
    button.disabled = false;
    button.textContent = '주소 검색';
  }
}

function openCheckout() {
  if (!cart.length) {
    showToast('장바구니에 상품을 먼저 담아주세요.');
    return;
  }
  if (!currentUser) {
    closeDrawers();
    setAuthTab('login');
    authModal.showModal();
    showToast('안전한 결제를 위해 먼저 로그인해 주세요.');
    return;
  }
  closeDrawers();
  closePostcodeSearch();
  renderCheckoutSummary();
  const form = document.querySelector('#checkout-form');
  if (currentUser?.email && !form.elements.email.value) form.elements.email.value = currentUser.email;
  const memberName = document.querySelector('#member-name').textContent.trim();
  if (currentUser && memberName && !form.elements.customerName.value) form.elements.customerName.value = memberName;
  checkoutModal.showModal();
}

async function invokePaymentFunction(body) {
  const { data, error } = await supabase.functions.invoke('toss-payment', { body });
  if (!error) return data;
  let message = error.message || '결제 요청을 처리하지 못했습니다.';
  try {
    const payload = await error.context.json();
    message = payload.message || message;
  } catch {
    // The function response did not include a JSON error body.
  }
  throw new Error(message);
}

function setPaymentBusy(busy) {
  const button = document.querySelector('#place-order-button');
  button.disabled = busy;
  button.innerHTML = busy ? '결제 준비 중 <span>···</span>' : '토스 테스트 결제 <span>→</span>';
}

function showPaymentResult({ success, title, message, orderNumber = '-', amount = null, receiptUrl = null }) {
  paymentResultModal.classList.toggle('is-error', !success);
  document.querySelector('#payment-result-kicker').textContent = success ? 'PAYMENT COMPLETE' : 'PAYMENT FAILED';
  document.querySelector('#payment-result-mark').textContent = success ? '✓' : '!';
  document.querySelector('#payment-result-title').innerHTML = title;
  document.querySelector('#payment-result-message').textContent = message;
  document.querySelector('#payment-result-order').textContent = orderNumber;
  document.querySelector('#payment-result-amount').textContent = amount !== null && amount !== '' && Number.isFinite(Number(amount)) ? won(Number(amount)) : '-';
  const receipt = document.querySelector('#payment-receipt');
  receipt.hidden = !receiptUrl;
  if (receiptUrl) receipt.href = receiptUrl;
  if (!paymentResultModal.open) paymentResultModal.showModal();
}

async function requestTossTestPayment(form) {
  if (!currentUser) throw new Error('로그인이 필요합니다.');
  if (!window.TossPayments) throw new Error('토스페이먼츠 결제창을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');

  const values = Object.fromEntries(new FormData(form));
  const prepared = await invokePaymentFunction({
    action: 'prepare',
    items: cart.map(item => ({ productId: item.id, quantity: item.quantity })),
    checkout: values
  });
  const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
  const payment = tossPayments.payment({ customerKey: currentUser.id });
  const successUrl = new URL(window.location.pathname, window.location.origin);
  successUrl.searchParams.set('payment', 'success');
  const failUrl = new URL(window.location.pathname, window.location.origin);
  failUrl.searchParams.set('payment', 'fail');

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: prepared.amount },
    orderId: prepared.orderId,
    orderName: prepared.orderName,
    successUrl: successUrl.href,
    failUrl: failUrl.href,
    customerEmail: values.email.trim(),
    customerName: values.customerName.trim(),
    customerMobilePhone: values.phone.replace(/\D/g, ''),
    card: {
      useEscrow: false,
      flowMode: 'DEFAULT',
      useCardPoint: false,
      useAppCardOnly: false
    }
  });
}

async function handlePaymentRedirect() {
  const params = new URLSearchParams(window.location.search);
  const paymentState = params.get('payment');
  if (!paymentState) return;

  if (paymentState === 'fail') {
    showPaymentResult({
      success: false,
      title: '테스트 결제가<br />완료되지 않았습니다.',
      message: params.get('message') || '결제가 취소되었거나 승인에 실패했습니다.'
    });
  } else if (paymentState === 'success') {
    showToast('토스 테스트 결제를 승인하고 있습니다.');
    try {
      const result = await invokePaymentFunction({
        action: 'confirm',
        paymentKey: params.get('paymentKey'),
        orderId: params.get('orderId'),
        amount: Number(params.get('amount'))
      });
      cart = [];
      renderCart();
      showPaymentResult({
        success: true,
        title: '테스트 결제가<br />완료되었습니다.',
        message: '실제 금액 청구 없이 주문을 안전하게 접수했습니다.',
        orderNumber: result.orderNumber,
        amount: result.amount,
        receiptUrl: result.receiptUrl
      });
    } catch (error) {
      console.error(error);
      showPaymentResult({
        success: false,
        title: '결제 승인을<br />확인해 주세요.',
        message: error.message || '테스트 결제 승인 중 오류가 발생했습니다.'
      });
    }
  }

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
}

function renderWishlist() {
  document.querySelectorAll('.wish-count').forEach(element => element.textContent = wishes.size);
  const container = document.querySelector('#wishlist-items');
  const savedProducts = [...wishes].map(id => products.find(product => product.id === id)).filter(Boolean);
  if (!savedProducts.length) {
    container.innerHTML = '<div class="wishlist-empty"><p>관심상품이 비어 있습니다.</p><small>마음에 드는 상품의 하트를 눌러 저장해 보세요.</small></div>';
    return;
  }
  container.innerHTML = savedProducts.map(product => `<article class="wishlist-line">
    <button class="wishlist-line-image sprite ${product.category} pos-${product.image}" type="button" data-wishlist-product="${product.id}" aria-label="${product.name} 상세 보기"></button>
    <div><h3>${product.name}</h3><p>${won(product.price)}</p><div class="wishlist-actions"><button type="button" data-wishlist-product="${product.id}">VIEW</button><button type="button" data-wishlist-add="${product.id}">ADD TO BAG</button></div></div>
    <button class="wishlist-remove" type="button" data-wishlist-remove="${product.id}" aria-label="${product.name} 관심상품 삭제">×</button>
  </article>`).join('');
}

function refreshWishlistUI(id) {
  renderProducts();
  renderBest();
  renderWishlist();
  if (selectedProduct?.id === id) document.querySelector('#modal-wish').textContent = wishes.has(id) ? '♥ WISHED' : '♡ WISH';
}

async function toggleWish(id) {
  if (!products.some(product => product.id === id)) return;
  const adding = !wishes.has(id);
  adding ? wishes.add(id) : wishes.delete(id);
  refreshWishlistUI(id);

  let error = null;
  if (!currentUser) saveGuestWishlist();
  else if (adding) ({ error } = await supabase.from('wishlist_items').insert({ user_id: currentUser.id, product_id: id }));
  else ({ error } = await supabase.from('wishlist_items').delete().eq('user_id', currentUser.id).eq('product_id', id));

  if (error) {
    console.error(error);
    adding ? wishes.delete(id) : wishes.add(id);
    refreshWishlistUI(id);
    showToast('관심상품을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  showToast(adding ? '관심상품에 저장했습니다.' : '관심상품에서 삭제했습니다.');
}

async function loadAccountWishlist() {
  if (!currentUser) {
    wishes = new Set(readGuestWishlist());
    refreshWishlistUI();
    return;
  }
  const { data, error } = await supabase.from('wishlist_items').select('product_id').order('created_at');
  if (error) {
    console.error(error);
    showToast('관심상품을 불러오지 못했습니다.');
    return;
  }
  wishes = new Set((data || []).map(item => item.product_id).filter(id => products.some(product => product.id === id)));
  refreshWishlistUI();
}

async function mergeGuestWishlistIntoAccount() {
  const guestWishes = readGuestWishlist();
  if (!currentUser || !guestWishes.length) {
    await loadAccountWishlist();
    return;
  }
  const { data, error } = await supabase.from('wishlist_items').select('product_id');
  if (error) {
    console.error(error);
    await loadAccountWishlist();
    return;
  }
  const existing = new Set((data || []).map(item => item.product_id));
  const rows = guestWishes.filter(id => !existing.has(id)).map(productId => ({ user_id: currentUser.id, product_id: productId }));
  if (rows.length) {
    const { error: insertError } = await supabase.from('wishlist_items').insert(rows);
    if (insertError) {
      console.error(insertError);
      showToast('임시 관심상품을 계정에 합치지 못했습니다.');
      await loadAccountWishlist();
      return;
    }
  }
  localStorage.removeItem(GUEST_WISHLIST_KEY);
  await loadAccountWishlist();
}

function openProduct(id) {
  selectedProduct = products.find(product => product.id === id);
  const modal = document.querySelector('#product-modal');
  const image = document.querySelector('#modal-image');
  image.className = `modal-image sprite ${selectedProduct.category} pos-${selectedProduct.image}`;
  document.querySelector('#modal-category').textContent = selectedProduct.label;
  document.querySelector('#modal-name').textContent = selectedProduct.name;
  document.querySelector('#modal-description').textContent = selectedProduct.description;
  document.querySelector('#modal-price').textContent = won(selectedProduct.price);
  document.querySelector('#modal-original').textContent = selectedProduct.originalPrice ? won(selectedProduct.originalPrice) : '';
  document.querySelector('#modal-material').textContent = selectedProduct.material;
  document.querySelector('#modal-wish').textContent = wishes.has(id) ? '♥ WISHED' : '♡ WISH';
  modal.showModal();
}

function selectCategory(filter) {
  currentFilter = filter;
  currentSearch = '';
  document.querySelector('#search-input').value = '';
  closeDrawers();
  renderProducts();
  document.querySelector('#products').scrollIntoView({behavior:'smooth'});
}

document.addEventListener('click', async event => {
  const add = event.target.closest('[data-add]');
  const wish = event.target.closest('[data-wish]');
  const category = event.target.closest('[data-category]');
  const filter = event.target.closest('[data-filter]');
  const productOpen = event.target.closest('[data-open]');
  if (add) { event.stopPropagation(); await addToCart(add.dataset.add); return; }
  if (wish) { event.stopPropagation(); await toggleWish(wish.dataset.wish); return; }
  if (category) { selectCategory(category.dataset.category); return; }
  if (filter) { currentFilter = filter.dataset.filter; renderProducts(); return; }
  if (productOpen) openProduct(productOpen.dataset.open);
});

document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawers(); });

document.querySelector('[data-close-notice]').addEventListener('click', event => event.currentTarget.parentElement.remove());
document.querySelectorAll('[data-drawer-close]').forEach(button => button.addEventListener('click', closeDrawers));
document.querySelector('[data-search-open]').addEventListener('click', () => { openDrawer('.search-drawer'); setTimeout(() => document.querySelector('#search-input').focus(), 350); });
document.querySelector('[data-wishlist-open]').addEventListener('click', () => openDrawer('.wishlist-drawer'));
document.querySelector('[data-cart-open]').addEventListener('click', () => openDrawer('.cart-drawer'));
document.querySelector('[data-menu-open]').addEventListener('click', () => openDrawer('.mobile-nav'));
document.querySelector('#sort-select').addEventListener('change', event => { currentSort = event.target.value; renderProducts(); });

function runSearch(value) {
  currentSearch = value.trim(); currentFilter = 'all'; closeDrawers(); renderProducts(); document.querySelector('#products').scrollIntoView({behavior:'smooth'});
}
document.querySelector('#search-submit').addEventListener('click', () => runSearch(document.querySelector('#search-input').value));
document.querySelector('#search-input').addEventListener('keydown', event => { if (event.key === 'Enter') runSearch(event.target.value); });
document.querySelectorAll('[data-keyword]').forEach(button => button.addEventListener('click', () => runSearch(button.dataset.keyword)));

document.querySelector('#cart-items').addEventListener('click', async event => {
  const quantityButton = event.target.closest('[data-quantity]');
  const removeButton = event.target.closest('[data-remove]');
  if (removeButton) {
    const id = removeButton.dataset.remove;
    cart = cart.filter(item => item.id !== id);
    renderCart();
    await deleteCartLine(id);
    return;
  }
  if (quantityButton) {
    const item = cart.find(line => line.id === quantityButton.dataset.id);
    item.quantity = Math.min(10, item.quantity + (quantityButton.dataset.quantity === 'plus' ? 1 : -1));
    if (item.quantity <= 0) {
      cart = cart.filter(line => line.id !== item.id);
      renderCart();
      await deleteCartLine(item.id);
      return;
    }
    renderCart();
    await saveCartLine(item);
  }
});

document.querySelector('#wishlist-items').addEventListener('click', async event => {
  const removeButton = event.target.closest('[data-wishlist-remove]');
  const addButton = event.target.closest('[data-wishlist-add]');
  const productButton = event.target.closest('[data-wishlist-product]');
  if (removeButton) {
    await toggleWish(removeButton.dataset.wishlistRemove);
    return;
  }
  if (addButton) {
    await addToCart(addButton.dataset.wishlistAdd);
    return;
  }
  if (productButton) {
    closeDrawers();
    openProduct(productButton.dataset.wishlistProduct);
  }
});

document.querySelector('.modal-close').addEventListener('click', () => document.querySelector('#product-modal').close());
document.querySelector('#product-modal').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
document.querySelector('#modal-cart').addEventListener('click', async () => { if (selectedProduct) await addToCart(selectedProduct.id); document.querySelector('#product-modal').close(); openDrawer('.cart-drawer'); });
document.querySelector('#modal-wish').addEventListener('click', async () => { if (selectedProduct) await toggleWish(selectedProduct.id); });
document.querySelector('#checkout-button').addEventListener('click', openCheckout);
document.querySelector('.checkout-close').addEventListener('click', () => { closePostcodeSearch(); checkoutModal.close(); });
checkoutModal.addEventListener('click', event => {
  if (event.target === checkoutModal) { closePostcodeSearch(); checkoutModal.close(); }
});
document.querySelector('#postcode-search-button').addEventListener('click', openPostcodeSearch);
document.querySelector('#postcode-layer-close').addEventListener('click', closePostcodeSearch);
document.querySelector('#checkout-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  setPaymentBusy(true);
  try {
    await requestTossTestPayment(form);
  } catch (error) {
    console.error(error);
    const cancelled = error?.code === 'USER_CANCEL' || /cancel/i.test(error?.message || '');
    showToast(cancelled ? '테스트 결제를 취소했습니다.' : (error.message || '결제창을 열지 못했습니다.'));
  } finally {
    setPaymentBusy(false);
  }
});
document.querySelector('.payment-result-close').addEventListener('click', () => paymentResultModal.close());
document.querySelector('#payment-result-home').addEventListener('click', () => { paymentResultModal.close(); window.location.hash = 'products'; });
paymentResultModal.addEventListener('click', event => { if (event.target === paymentResultModal) paymentResultModal.close(); });
document.querySelector('#newsletter-form').addEventListener('submit', event => { event.preventDefault(); showToast('구독이 완료되었습니다. 반가워요!'); event.currentTarget.reset(); });

const authModal = document.querySelector('#auth-modal');
const authGuest = document.querySelector('#auth-guest');
const memberPanel = document.querySelector('#member-panel');

function setAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button.dataset.authTab === tab));
  document.querySelectorAll('[data-auth-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.authPane === tab));
  document.querySelectorAll('.form-error').forEach(error => error.textContent = '');
}

function setFormBusy(form, busy) {
  form.querySelectorAll('input,button').forEach(control => control.disabled = busy);
  const submit = form.querySelector('.auth-submit');
  submit.dataset.label ||= submit.innerHTML;
  submit.innerHTML = busy ? 'PLEASE WAIT <span>···</span>' : submit.dataset.label;
}

function authErrorMessage(error) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return '이메일 또는 비밀번호를 확인해주세요.';
  if (message.includes('email not confirmed')) return '이메일 인증을 완료한 후 로그인해주세요.';
  if (message.includes('already registered') || message.includes('already been registered')) return '이미 가입된 이메일입니다.';
  if (message.includes('password')) return '비밀번호는 영문과 숫자를 포함해 8자 이상 입력해주세요.';
  if (message.includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

async function renderAuthState() {
  const loggedIn = Boolean(currentUser);
  authGuest.hidden = loggedIn;
  memberPanel.hidden = !loggedIn;
  document.querySelectorAll('.account-label').forEach(label => {
    label.textContent = loggedIn ? 'MY NUVE' : 'ACCOUNT';
    label.classList.toggle('logged-in', loggedIn);
  });
  document.querySelectorAll('.mobile-account-link').forEach(button => button.textContent = loggedIn ? 'MY NUVE / LOGOUT' : 'LOGIN / JOIN');
  if (!loggedIn) return;

  const { data, error } = await supabase.from('profiles').select('display_name,phone').eq('id', currentUser.id).maybeSingle();
  if (error) console.error(error);
  const displayName = data?.display_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '회원';
  document.querySelector('#member-name').textContent = displayName;
  document.querySelector('#member-email').textContent = currentUser.email || '';
}

async function handleAuthSession(session) {
  const previousUserId = currentUser?.id;
  currentUser = session?.user || null;
  await renderAuthState();
  if (currentUser && previousUserId !== currentUser.id) {
    await Promise.all([mergeGuestCartIntoAccount(), mergeGuestWishlistIntoAccount()]);
  } else {
    await Promise.all([loadAccountCart(), loadAccountWishlist()]);
  }
}

document.querySelectorAll('[data-auth-open]').forEach(button => button.addEventListener('click', () => {
  closeDrawers();
  if (!currentUser) setAuthTab('login');
  authModal.showModal();
}));
document.querySelector('.auth-close').addEventListener('click', () => authModal.close());
authModal.addEventListener('click', event => { if (event.target === authModal) authModal.close(); });
document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));

document.querySelectorAll('[data-google-login]').forEach(button => button.addEventListener('click', async () => {
  document.querySelectorAll('[data-google-login]').forEach(item => item.disabled = true);
  sessionStorage.setItem('nuve_oauth_pending', 'google');
  // GitHub Pages처럼 하위 경로에 배포해도 현재 쇼핑몰 주소로 돌아오게 한다.
  const redirectTo = new URL(window.location.pathname, window.location.origin).href;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) {
    sessionStorage.removeItem('nuve_oauth_pending');
    document.querySelectorAll('[data-google-login]').forEach(item => item.disabled = false);
    showToast(authErrorMessage(error));
  }
}));

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.querySelector('[data-login-error]');
  errorBox.textContent = '';
  if (!form.reportValidity()) return;
  setFormBusy(form, true);
  const values = new FormData(form);
  const { data, error } = await supabase.auth.signInWithPassword({ email: values.get('email').trim(), password: values.get('password') });
  setFormBusy(form, false);
  if (error) { errorBox.textContent = authErrorMessage(error); return; }
  await handleAuthSession(data.session);
  form.reset();
  authModal.close();
  showToast('로그인되었습니다. 계정 장바구니를 불러왔습니다.');
});

document.querySelector('#register-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.querySelector('[data-register-error]');
  const values = new FormData(form);
  const name = values.get('name').trim();
  const phoneDigits = values.get('phone').replace(/\D/g, '');
  const phone = phoneDigits.length === 11 ? phoneDigits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : values.get('phone').trim();
  const email = values.get('email').trim();
  const password = values.get('password');
  errorBox.textContent = '';
  if (!form.reportValidity()) return;
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) { errorBox.textContent = '비밀번호는 영문과 숫자를 포함해 8자 이상 입력해주세요.'; return; }
  if (password !== values.get('passwordConfirm')) { errorBox.textContent = '비밀번호가 서로 일치하지 않습니다.'; return; }
  if (!/^010-\d{4}-\d{4}$/.test(phone)) { errorBox.textContent = '휴대폰 번호를 정확히 입력해주세요.'; return; }
  setFormBusy(form, true);
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone } } });
  setFormBusy(form, false);
  if (error) { errorBox.textContent = authErrorMessage(error); return; }
  form.reset();
  if (data.session) {
    await handleAuthSession(data.session);
    authModal.close();
    showToast('회원가입과 로그인이 완료되었습니다.');
  } else {
    setAuthTab('login');
    document.querySelector('#login-form [name="email"]').value = email;
    showToast('가입 확인 이메일을 보냈습니다. 인증 후 로그인해주세요.');
  }
});

document.querySelector('#forgot-password').addEventListener('click', async () => {
  const emailInput = document.querySelector('#login-form [name="email"]');
  if (!emailInput.value || !emailInput.checkValidity()) { emailInput.reportValidity(); return; }
  const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim());
  showToast(error ? authErrorMessage(error) : '비밀번호 재설정 이메일을 보냈습니다.');
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { showToast(authErrorMessage(error)); return; }
  currentUser = null;
  cart = readGuestCart();
  await renderAuthState();
  renderCart();
  authModal.close();
  showToast('안전하게 로그아웃되었습니다.');
});

document.querySelectorAll('.member-menu button').forEach(button => button.addEventListener('click', () => showToast('마이페이지 상세 기능은 준비 중입니다.')));

renderBest();
renderProducts();
renderCart();
renderWishlist();

const { data: { session: initialSession } } = await supabase.auth.getSession();
await handleAuthSession(initialSession);
await handlePaymentRedirect();
const oauthHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
if (oauthHash.get('error_description')) {
  showToast(decodeURIComponent(oauthHash.get('error_description').replace(/\+/g, ' ')));
  sessionStorage.removeItem('nuve_oauth_pending');
}
if (initialSession && sessionStorage.getItem('nuve_oauth_pending') === 'google') {
  sessionStorage.removeItem('nuve_oauth_pending');
  showToast('Google 계정으로 로그인되었습니다.');
}
if (/access_token=|error_description=/.test(window.location.hash)) {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}
supabase.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => handleAuthSession(session), 0);
});
