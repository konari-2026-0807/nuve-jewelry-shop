import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = value => `${new Intl.NumberFormat('ko-KR').format(Number(value) || 0)}원`;
const day = value => new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(new Date(value));
const dateTime = value => new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const jewelryPattern = /^(earrings|necklaces|bracelets|rings)-(\d+)$/;
const categoryNames = { earrings: '귀걸이', necklaces: '목걸이', bracelets: '팔찌', rings: '반지' };
const statusNames = { pending: '결제대기', confirmed: '신규주문', preparing: '상품준비', shipped: '배송중', delivered: '배송완료', cancelled: '취소' };
const orderStatusOptions = Object.entries(statusNames).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

let currentUser = null;
let orders = [];
let products = [];
let customers = [];
let chartMetric = 'orders';
let toastTimer;
let bootstrapAvailable = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function showOnly(id) {
  ['admin-login', 'access-denied', 'admin-shell'].forEach(name => {
    const element = $(`#${name}`);
    element.hidden = name !== id;
  });
}

function setLoginMode(setupMode) {
  bootstrapAvailable = setupMode;
  $('#admin-login-form').hidden = setupMode;
  $('#google-admin-login').hidden = setupMode;
  $('#admin-setup-form').hidden = !setupMode;
  $('#login-eyebrow').textContent = setupMode ? 'INITIAL SETUP' : 'ADMIN ACCESS';
  $('#login-title').textContent = setupMode ? '새 관리자 등록' : '관리자 로그인';
  $('#login-description').textContent = setupMode
    ? '새롭게 사용할 관리자 계정을 등록해 주세요.'
    : 'NUVE 관리자 계정으로 로그인해 주세요.';
}

async function checkBootstrapAvailability() {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bootstrap`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) throw new Error(`bootstrap status ${response.status}`);
    const data = await response.json();
    setLoginMode(data.available === true);
    return bootstrapAvailable;
  } catch (error) {
    console.error(error);
    setLoginMode(false);
    return false;
  }
}

function toast(message) {
  const element = $('#admin-toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
}

async function isAdmin(userId) {
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function startAdmin(session) {
  if (!session?.user) {
    currentUser = null;
    await checkBootstrapAvailability();
    showOnly('admin-login');
    return;
  }
  currentUser = session.user;
  try {
    if (!(await isAdmin(currentUser.id))) {
      if (await checkBootstrapAvailability()) {
        showOnly('admin-login');
        return;
      }
      showOnly('access-denied');
      return;
    }
    $('#admin-email').textContent = currentUser.email || 'ADMIN';
    showOnly('admin-shell');
    await loadData();
  } catch (error) {
    console.error(error);
    showOnly('admin-login');
    $('#login-error').textContent = '관리자 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

async function loadData({ notify = false } = {}) {
  $('#refresh-data').disabled = true;
  const [ordersResult, productsResult] = await Promise.all([
    supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
    supabase.from('store_products').select('slug,name,price,image,active,stock,updated_at').order('slug'),
  ]);
  $('#refresh-data').disabled = false;
  if (ordersResult.error) throw ordersResult.error;
  if (productsResult.error) throw productsResult.error;

  products = productsResult.data.filter(product => jewelryPattern.test(product.slug));
  orders = ordersResult.data.filter(order => (order.order_items || []).some(item => jewelryPattern.test(item.product_slug)));
  customers = buildCustomers(orders);
  renderAll();
  if (notify) toast('최신 데이터로 새로고침했습니다.');
}

function buildCustomers(source) {
  const map = new Map();
  source.forEach(order => {
    const key = order.customer_email || order.user_id || `${order.customer_name}-${order.phone}`;
    const item = map.get(key) || {
      key,
      name: order.customer_name || '이름 없음',
      email: order.customer_email || '-',
      phone: order.phone || '-',
      orders: 0,
      spent: 0,
      recent: order.created_at,
    };
    item.orders += 1;
    if (isPaid(order) && order.status !== 'cancelled') item.spent += Number(order.total) || 0;
    if (new Date(order.created_at) > new Date(item.recent)) item.recent = order.created_at;
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => new Date(b.recent) - new Date(a.recent));
}

function isPaid(order) {
  return ['paid', 'test_paid', 'done'].includes(order.payment_status);
}

function getProductMeta(slug) {
  const match = slug.match(jewelryPattern);
  return match ? { category: match[1], index: Math.max(0, Number(match[2]) - 1) } : { category: '', index: 0 };
}

function sprite(product) {
  const { category, index } = getProductMeta(product.slug);
  return `sprite-${category} pos-${index}`;
}

function statusPill(status) {
  return `<span class="status-pill ${escapeHtml(status)}">${statusNames[status] || escapeHtml(status || '-')}</span>`;
}

function renderAll() {
  const today = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date());
  $('#today-label').textContent = `${today} · 실시간 운영 현황`;
  renderStatus();
  renderChart($('#sales-chart'), chartMetric);
  renderActions();
  renderRecentOrders();
  renderInventory();
  renderProducts();
  renderOrders();
  renderCustomers();
  renderAnalytics();
  $('#nav-order-badge').textContent = orders.filter(order => ['confirmed', 'preparing'].includes(order.status)).length;
}

function renderStatus() {
  const statuses = [
    ['pending', '결제대기', '◷'],
    ['confirmed', '신규주문', '＋'],
    ['preparing', '상품준비', '◇'],
    ['shipped', '배송중', '→'],
    ['cancelled', '취소', '×'],
  ];
  $('#status-grid').innerHTML = statuses.map(([status, label, icon]) => `
    <article class="status-card"><span class="status-icon">${icon}</span><div><p>${label}</p><strong>${orders.filter(order => order.status === status).length}</strong><small>건</small></div></article>
  `).join('');
}

function makeDailySeries(metric, days = 14) {
  const rows = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const daily = orders.filter(order => {
      const created = new Date(order.created_at);
      return created >= date && created < next && order.status !== 'cancelled';
    });
    let value = daily.length;
    if (metric === 'items') value = daily.reduce((sum, order) => sum + (order.order_items || []).reduce((count, item) => count + Number(item.quantity || 0), 0), 0);
    if (metric === 'revenue') value = daily.filter(isPaid).reduce((sum, order) => sum + Number(order.total || 0), 0);
    rows.push({ date, value });
  }
  return rows;
}

function renderChart(container, metric) {
  const rows = makeDailySeries(metric);
  const width = 900;
  const height = 260;
  const pad = { left: 46, right: 24, top: 28, bottom: 34 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const rawMax = Math.max(...rows.map(row => row.value), 1);
  const max = rawMax * 1.18;
  const points = rows.map((row, index) => ({
    ...row,
    x: pad.left + innerWidth * (index / Math.max(rows.length - 1, 1)),
    y: pad.top + innerHeight - (row.value / max) * innerHeight,
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const area = `${line} L ${points.at(-1).x} ${pad.top + innerHeight} L ${points[0].x} ${pad.top + innerHeight} Z`;
  const formatter = value => metric === 'revenue' ? (value >= 10000 ? `${Math.round(value / 10000)}만` : new Intl.NumberFormat('ko-KR').format(value)) : value;
  const grid = [0, .25, .5, .75, 1].map(ratio => {
    const y = pad.top + innerHeight * ratio;
    const label = formatter(Math.round(max * (1 - ratio)));
    return `<line class="chart-grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/><text class="chart-label" x="0" y="${y + 3}">${label}</text>`;
  }).join('');
  const labels = points.map((point, index) => index % 2 === 0 || index === points.length - 1 ? `<text class="chart-label" text-anchor="middle" x="${point.x}" y="${height - 7}">${day(point.date)}</text>` : '').join('');
  const dots = points.map(point => `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="3"><title>${day(point.date)} · ${formatter(point.value)}</title></circle>`).join('');
  container.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="최근 14일 통계">
    <defs><linearGradient id="chart-gradient-${container.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f806e" stop-opacity=".22"/><stop offset="1" stop-color="#4f806e" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#chart-gradient-${container.id})"/><path class="chart-line" d="${line}"/>${dots}${labels}
  </svg>`;
}

function renderActions() {
  const now = Date.now();
  const olderThan = (status, hours) => orders.filter(order => order.status === status && now - new Date(order.created_at).getTime() > hours * 3600000).length;
  const actions = [
    ['결제 확인 대기', orders.filter(order => order.status === 'pending').length, '◷'],
    ['신규 주문 처리', orders.filter(order => order.status === 'confirmed').length, '＋'],
    ['24시간 준비 지연', olderThan('preparing', 24), '!'],
    ['배송 상태 확인', orders.filter(order => order.status === 'shipped').length, '→'],
    ['취소 주문', orders.filter(order => order.status === 'cancelled').length, '×'],
    ['재고 부족', products.filter(product => Number(product.stock) <= 5).length, '◇'],
  ];
  $('#delay-list').innerHTML = actions.map(([label, value, icon]) => `<div class="delay-item"><span>${icon}</span><p>${label}</p><strong>${value}<small>건</small></strong></div>`).join('');
}

function renderRecentOrders() {
  const body = $('#recent-orders-body');
  const rows = orders.slice(0, 6);
  body.innerHTML = rows.length ? rows.map(order => {
    const items = order.order_items || [];
    const summary = items[0]?.product_name ? `${items[0].product_name}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}` : '-';
    return `<tr><td><strong>${escapeHtml(order.order_number || order.toss_order_id || '-')}</strong></td><td>${escapeHtml(order.customer_name || '-')}</td><td>${escapeHtml(summary)}</td><td>${money(order.total)}</td><td>${statusPill(order.status)}</td></tr>`;
  }).join('') : '<tr><td class="empty-row" colspan="5">아직 주문이 없습니다.</td></tr>';
}

function renderInventory() {
  const active = products.filter(product => product.active).length;
  const low = products.filter(product => Number(product.stock) <= 5).length;
  const stock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const activeRate = products.length ? Math.round(active / products.length * 100) : 0;
  $('#inventory-summary').innerHTML = `
    <div class="inventory-stat"><p>판매중 상품</p><strong>${active}</strong></div>
    <div class="inventory-stat"><p>재고 부족</p><strong>${low}</strong></div>
    <div class="inventory-stat wide"><p>총 재고 수량</p><strong>${stock}</strong><div class="progress-track"><i style="width:${activeRate}%"></i></div></div>`;
}

function filteredProducts() {
  const search = $('#product-search').value.trim().toLowerCase();
  const category = $('#product-category').value;
  const state = $('#product-state').value;
  return products.filter(product => {
    const meta = getProductMeta(product.slug);
    const matchesSearch = !search || product.name.toLowerCase().includes(search) || product.slug.includes(search);
    const matchesCategory = category === 'all' || meta.category === category;
    const matchesState = state === 'all' || (state === 'active' && product.active) || (state === 'inactive' && !product.active) || (state === 'low' && Number(product.stock) <= 5);
    return matchesSearch && matchesCategory && matchesState;
  });
}

function renderProducts() {
  const visible = filteredProducts();
  $('#product-total-label').textContent = `${products.length} PRODUCTS`;
  $('#products-body').innerHTML = visible.length ? visible.map(product => {
    const meta = getProductMeta(product.slug);
    return `<tr>
      <td><div class="product-cell"><div class="admin-product-image ${sprite(product)}"></div><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.slug)}</small></div></div></td>
      <td>${categoryNames[meta.category]}</td><td>${money(product.price)}</td><td class="${Number(product.stock) <= 5 ? 'stock-low' : ''}">${Number(product.stock)}개</td>
      <td><button class="visibility-toggle ${product.active ? 'active' : ''}" type="button" data-toggle-product="${product.slug}" aria-label="${product.active ? '상품 숨기기' : '상품 노출하기'}"></button></td>
      <td>${product.updated_at ? dateTime(product.updated_at) : '-'}</td><td><button class="row-action" type="button" data-edit-product="${product.slug}">수정</button></td></tr>`;
  }).join('') : '<tr><td class="empty-row" colspan="7">조건에 맞는 상품이 없습니다.</td></tr>';
}

function filteredOrders() {
  const search = $('#order-search').value.trim().toLowerCase();
  const state = $('#order-state').value;
  return orders.filter(order => {
    const haystack = `${order.order_number || ''} ${order.customer_name || ''} ${order.customer_email || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) && (state === 'all' || order.status === state);
  });
}

function renderOrders() {
  const visible = filteredOrders();
  $('#order-total-label').textContent = `${orders.length} ORDERS`;
  $('#orders-body').innerHTML = visible.length ? visible.map(order => {
    const items = order.order_items || [];
    const summary = items.map(item => `${item.product_name} × ${item.quantity}`).join(', ') || '-';
    const address = [order.postal_code && `(${order.postal_code})`, order.address_line1, order.address_line2].filter(Boolean).join(' ');
    return `<tr>
      <td class="order-cell"><strong>${escapeHtml(order.order_number || order.toss_order_id || '-')}</strong><small>${dateTime(order.created_at)}</small></td>
      <td>${escapeHtml(order.customer_name || '-')}</td><td class="customer-cell"><strong>${escapeHtml(order.customer_email || '-')}</strong><small>${escapeHtml(order.phone || '-')}</small></td>
      <td><div class="order-items-summary" title="${escapeHtml(summary)}">${escapeHtml(summary)}</div></td>
      <td><strong>${money(order.total)}</strong><small>${escapeHtml(order.payment_method || '-')} · ${isPaid(order) ? '결제완료' : '확인중'}</small></td>
      <td><select class="order-status-select" data-order-status="${order.id}">${orderStatusOptions}</select></td>
      <td class="address-cell">${escapeHtml(address || '-')}</td></tr>`;
  }).join('') : '<tr><td class="empty-row" colspan="7">조건에 맞는 주문이 없습니다.</td></tr>';
  $$('[data-order-status]').forEach(select => {
    const order = orders.find(item => item.id === select.dataset.orderStatus);
    if (order) select.value = order.status;
  });
}

function renderCustomers() {
  const search = $('#customer-search').value.trim().toLowerCase();
  const visible = customers.filter(customer => !search || `${customer.name} ${customer.email}`.toLowerCase().includes(search));
  $('#customer-total-label').textContent = `${customers.length} CUSTOMERS`;
  $('#customers-body').innerHTML = visible.length ? visible.map(customer => {
    const vip = customer.spent >= 200000 || customer.orders >= 5;
    return `<tr><td class="customer-cell"><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.email)}</small></td><td>${escapeHtml(customer.phone)}</td><td>${customer.orders}건</td><td><strong>${money(customer.spent)}</strong></td><td>${dateTime(customer.recent)}</td><td><span class="grade ${vip ? 'vip' : ''}">${vip ? 'VIP' : 'MEMBER'}</span></td></tr>`;
  }).join('') : '<tr><td class="empty-row" colspan="6">조건에 맞는 고객이 없습니다.</td></tr>';
}

function allJewelryItems() {
  return orders.flatMap(order => (order.order_items || []).filter(item => jewelryPattern.test(item.product_slug)).map(item => ({ ...item, order })));
}

function renderAnalytics() {
  const paid = orders.filter(order => isPaid(order) && order.status !== 'cancelled');
  const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const items = allJewelryItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const average = paid.length ? Math.round(revenue / paid.length) : 0;
  $('#analytics-kpis').innerHTML = [
    ['누적 결제금액', money(revenue), 'PAID REVENUE'],
    ['전체 주문', `${orders.length}건`, 'ALL ORDERS'],
    ['판매 상품', `${items}개`, 'ITEMS SOLD'],
    ['평균 주문금액', money(average), 'AVERAGE ORDER'],
  ].map(([label, value, sub]) => `<article class="analytics-kpi"><p>${label}</p><strong>${value}</strong><small>${sub}</small></article>`).join('');
  renderChart($('#analytics-chart'), 'revenue');

  const categoryCount = { earrings: 0, necklaces: 0, bracelets: 0, rings: 0 };
  const productCount = new Map();
  allJewelryItems().forEach(item => {
    const { category } = getProductMeta(item.product_slug);
    const quantity = Number(item.quantity || 0);
    categoryCount[category] += quantity;
    const current = productCount.get(item.product_slug) || { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += quantity;
    current.revenue += Number(item.line_total || 0);
    productCount.set(item.product_slug, current);
  });
  const maxCategory = Math.max(...Object.values(categoryCount), 1);
  $('#category-bars').innerHTML = Object.entries(categoryCount).map(([category, value]) => `<div><div class="category-bar-head"><span>${categoryNames[category]}</span><strong>${value}개</strong></div><div class="category-bar-track"><i style="width:${value / maxCategory * 100}%"></i></div></div>`).join('');
  const top = [...productCount.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  $('#top-products').innerHTML = top.length ? top.map((product, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><div>${escapeHtml(product.name)}<small>${product.quantity}개 판매</small></div><strong>${money(product.revenue)}</strong></li>`).join('') : '<li>아직 판매 데이터가 없습니다.</li>';
}

function changeView(view) {
  $$('.admin-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $$('.admin-view').forEach(section => section.classList.toggle('active', section.dataset.adminView === view));
  const titles = {
    dashboard: ['STORE OVERVIEW', '오늘의 스토어'], products: ['PRODUCT MANAGEMENT', '상품관리'], orders: ['ORDER MANAGEMENT', '판매관리'], customers: ['CUSTOMER MANAGEMENT', '고객관리'], analytics: ['STORE ANALYTICS', '통계'],
  };
  const [kicker, title] = titles[view] || titles.dashboard;
  $('#page-kicker').textContent = kicker;
  $('#page-title').textContent = title;
  $('#admin-sidebar').classList.remove('open');
  history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openProductModal(slug) {
  const product = products.find(item => item.slug === slug);
  if (!product) return;
  const form = $('#product-edit-form');
  form.elements.slug.value = product.slug;
  form.elements.name.value = product.name;
  form.elements.price.value = product.price;
  form.elements.stock.value = product.stock;
  form.elements.active.checked = product.active;
  $('#product-modal-error').textContent = '';
  $('#product-modal').showModal();
}

async function updateProduct(slug, patch) {
  const { error } = await supabase.from('store_products').update({ ...patch, updated_at: new Date().toISOString() }).eq('slug', slug);
  if (error) throw error;
  Object.assign(products.find(product => product.slug === slug), patch, { updated_at: new Date().toISOString() });
  renderProducts();
  renderInventory();
  renderActions();
}

$('#admin-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = $('button[type="submit"]', form);
  $('#login-error').textContent = '';
  submit.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
  submit.disabled = false;
  if (error) $('#login-error').textContent = '이메일 또는 비밀번호를 확인해 주세요.';
});

$('#admin-setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = $('button[type="submit"]', form);
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const errorBox = $('#setup-error');
  errorBox.textContent = '';
  if (password !== form.elements.passwordConfirm.value) {
    errorBox.textContent = '비밀번호가 서로 일치하지 않습니다.';
    return;
  }
  submit.disabled = true;
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bootstrap`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        admin_already_configured: '다른 관리자가 먼저 등록되었습니다. 로그인해 주세요.',
        invalid_email: '올바른 이메일 주소를 입력해 주세요.',
        invalid_password: '비밀번호는 8자 이상 72자 이하로 입력해 주세요.',
        account_create_failed: '관리자 계정을 만들지 못했습니다.',
        account_update_failed: '기존 계정을 관리자 계정으로 전환하지 못했습니다.',
      };
      throw new Error(messages[result.error] || '관리자 등록을 완료하지 못했습니다.');
    }
    setLoginMode(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('등록은 완료됐지만 자동 로그인하지 못했습니다. 새 계정으로 로그인해 주세요.');
    form.reset();
    await startAdmin(data.session);
    toast('새 관리자 계정이 등록되었습니다.');
  } catch (error) {
    errorBox.textContent = error.message;
    await checkBootstrapAvailability();
  } finally {
    submit.disabled = false;
  }
});

$('#google-admin-login').addEventListener('click', async () => {
  const redirectTo = new URL('admin.html', window.location.href).href;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, scopes: 'openid email profile', queryParams: { prompt: 'select_account' } } });
  if (error) $('#login-error').textContent = 'Google 로그인을 시작하지 못했습니다.';
});

async function logout() {
  await supabase.auth.signOut();
  location.replace('admin.html');
}

$('#admin-logout').addEventListener('click', logout);
$('#denied-logout').addEventListener('click', logout);
$('#refresh-data').addEventListener('click', () => loadData({ notify: true }).catch(error => { console.error(error); toast('데이터를 새로고침하지 못했습니다.'); }));
$('.sidebar-open').addEventListener('click', () => $('#admin-sidebar').classList.add('open'));
$('.sidebar-close').addEventListener('click', () => $('#admin-sidebar').classList.remove('open'));
$$('.admin-nav button').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
$$('[data-jump-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.jumpView)));
$$('[data-chart-metric]').forEach(button => button.addEventListener('click', () => {
  chartMetric = button.dataset.chartMetric;
  $$('[data-chart-metric]').forEach(item => item.classList.toggle('active', item === button));
  renderChart($('#sales-chart'), chartMetric);
}));

['product-search', 'product-category', 'product-state'].forEach(id => $(`#${id}`).addEventListener(id === 'product-search' ? 'input' : 'change', renderProducts));
['order-search', 'order-state'].forEach(id => $(`#${id}`).addEventListener(id === 'order-search' ? 'input' : 'change', renderOrders));
$('#customer-search').addEventListener('input', renderCustomers);

$('#products-body').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-product]');
  if (edit) return openProductModal(edit.dataset.editProduct);
  const toggle = event.target.closest('[data-toggle-product]');
  if (!toggle) return;
  const product = products.find(item => item.slug === toggle.dataset.toggleProduct);
  toggle.disabled = true;
  try {
    await updateProduct(product.slug, { active: !product.active });
    toast(product.active ? '쇼핑몰에 상품을 노출했습니다.' : '상품을 숨겼습니다.');
  } catch (error) {
    console.error(error);
    toast('상품 상태를 변경하지 못했습니다.');
  }
});

$('#orders-body').addEventListener('change', async event => {
  const select = event.target.closest('[data-order-status]');
  if (!select) return;
  const order = orders.find(item => item.id === select.dataset.orderStatus);
  const previous = order.status;
  select.disabled = true;
  const { error } = await supabase.from('orders').update({ status: select.value }).eq('id', order.id);
  select.disabled = false;
  if (error) {
    select.value = previous;
    toast('주문 상태를 변경하지 못했습니다.');
    return;
  }
  order.status = select.value;
  renderAll();
  toast(`주문 상태를 '${statusNames[order.status]}'로 변경했습니다.`);
});

$('#product-edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = $('.modal-submit', form);
  submit.disabled = true;
  $('#product-modal-error').textContent = '';
  try {
    await updateProduct(form.elements.slug.value, {
      name: form.elements.name.value.trim(),
      price: Number(form.elements.price.value),
      stock: Number(form.elements.stock.value),
      active: form.elements.active.checked,
    });
    $('#product-modal').close();
    toast('상품 정보를 저장했습니다.');
  } catch (error) {
    console.error(error);
    $('#product-modal-error').textContent = '상품 정보를 저장하지 못했습니다.';
  } finally {
    submit.disabled = false;
  }
});

$('.modal-x').addEventListener('click', () => $('#product-modal').close());
$('#product-modal').addEventListener('click', event => { if (event.target === $('#product-modal')) $('#product-modal').close(); });

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => startAdmin(session), 0);
});

const { data: { session } } = await supabase.auth.getSession();
await checkBootstrapAvailability();
await startAdmin(session);
changeView(location.hash.slice(1) || 'dashboard');
