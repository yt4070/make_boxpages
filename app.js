/**
 * Box メタデータビューア - フロントエンド制御ロジック
 */

// ストレージキー
const STORAGE_KEYS = {
  TOKEN: 'box_dev_token',
  FOLDER_ID: 'box_folder_id',
};

// Box APIの除外対象内部メタデータキー
const INTERNAL_META_KEYS = new Set([
  '$id',
  '$type',
  '$typeVersion',
  '$parent',
  '$version',
  '$template',
  '$scope',
]);

// アプリケーション状態
const state = {
  items: [],          // 取得した全アイテム [{ id, type, name, modified_at, size, metadata: { ... } }]
  metadataKeys: [],   // 検出されたメタデータキー一覧 ['メタデータ1', 'メタデータ2', ...]
  isLoading: false,
};

// DOM要素
const elements = {
  fetchForm: document.getElementById('fetchForm'),
  devTokenInput: document.getElementById('devToken'),
  folderIdInput: document.getElementById('folderId'),
  fetchBtn: document.getElementById('fetchBtn'),
  toggleTokenBtn: document.getElementById('toggleTokenVisibility'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  clearStorageBtn: document.getElementById('clearStorageBtn'),
  saveStatus: document.getElementById('saveStatus'),

  helpToggleBtn: document.getElementById('helpToggleBtn'),
  helpGuideCard: document.getElementById('helpGuideCard'),
  closeGuideBtn: document.getElementById('closeGuideBtn'),

  statusBanner: document.getElementById('statusBanner'),
  bannerTitle: document.getElementById('bannerTitle'),
  bannerMessage: document.getElementById('bannerMessage'),
  bannerIcon: document.getElementById('bannerIcon'),
  closeBannerBtn: document.getElementById('closeBannerBtn'),

  searchInput: document.getElementById('searchInput'),
  itemCountBadge: document.getElementById('itemCountBadge'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),

  initialState: document.getElementById('initialState'),
  loadingState: document.getElementById('loadingState'),
  loadingText: document.getElementById('loadingText'),
  metadataTable: document.getElementById('metadataTable'),
  tableHead: document.getElementById('tableHead'),
  tableBody: document.getElementById('tableBody'),
  noMatchState: document.getElementById('noMatchState'),

  // AIモーダル関連
  aiModal: document.getElementById('aiModal'),
  modalFileName: document.getElementById('modalFileName'),
  modalLoading: document.getElementById('modalLoading'),
  modalSummaryContent: document.getElementById('modalSummaryContent'),
  summaryText: document.getElementById('summaryText'),
  modalError: document.getElementById('modalError'),
  modalErrorMessage: document.getElementById('modalErrorMessage'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  closeModalFooterBtn: document.getElementById('closeModalFooterBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadStoredSettings();
  setupEventListeners();
});

// ローカルストレージから設定を復元
function loadStoredSettings() {
  const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const savedFolderId = localStorage.getItem(STORAGE_KEYS.FOLDER_ID);

  if (savedToken) elements.devTokenInput.value = savedToken;
  if (savedFolderId) elements.folderIdInput.value = savedFolderId;
}

// イベントリスナーの登録
function setupEventListeners() {
  // フォーム送信
  elements.fetchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFetchMetadata();
  });

  // トークン表示/非表示切り替え
  elements.toggleTokenBtn.addEventListener('click', () => {
    const isPassword = elements.devTokenInput.type === 'password';
    elements.devTokenInput.type = isPassword ? 'text' : 'password';
    elements.toggleTokenBtn.title = isPassword ? 'トークンを隠す' : 'トークンを表示';
  });

  // デモデータ読み込み
  elements.loadDemoBtn.addEventListener('click', () => {
    loadDemoData();
  });

  // 設定クリア
  elements.clearStorageBtn.addEventListener('click', () => {
    if (confirm('保存されたトークンとフォルダIDをクリアしますか？')) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.FOLDER_ID);
      elements.devTokenInput.value = '';
      elements.folderIdInput.value = '';
      showToast('設定をクリアしました', 'info');
    }
  });

  // ガイド開閉
  elements.helpToggleBtn.addEventListener('click', () => {
    const isHidden = elements.helpGuideCard.classList.toggle('hidden');
    elements.helpToggleBtn.setAttribute('aria-expanded', String(!isHidden));
  });
  elements.closeGuideBtn.addEventListener('click', () => {
    elements.helpGuideCard.classList.add('hidden');
    elements.helpToggleBtn.setAttribute('aria-expanded', 'false');
  });

  // バナー閉じる
  elements.closeBannerBtn.addEventListener('click', hideBanner);

  // 検索入力
  elements.searchInput.addEventListener('input', () => {
    filterAndRenderTable();
  });

  // CSVエクスポート
  elements.exportCsvBtn.addEventListener('click', exportTableToCsv);

  // AIモーダル操作
  elements.closeModalBtn.addEventListener('click', closeAiModal);
  elements.closeModalFooterBtn.addEventListener('click', closeAiModal);
  elements.aiModal.addEventListener('click', (e) => {
    if (e.target === elements.aiModal) closeAiModal();
  });
  elements.copySummaryBtn.addEventListener('click', () => {
    const text = elements.summaryText.textContent;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        elements.copySummaryBtn.textContent = 'コピー完了！';
        setTimeout(() => {
          elements.copySummaryBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            要約をコピー
          `;
        }, 2000);
      });
    }
  });
}

// デモ用ダミーデータの読み込み
function loadDemoData() {
  hideBanner();
  setLoading(true, 'デモデータを読み込み中...');

  setTimeout(() => {
    state.metadataKeys = ['メタデータ1 (分類)', 'メタデータ2 (ステータス)'];
    state.items = [
      {
        id: '1001',
        type: 'file',
        name: '2026年度_事業企画書.pdf',
        modified_at: '2026-10-24T10:30:00Z',
        size: 1542000,
        metadata: {
          'メタデータ1 (分類)': '企画・戦略',
          'メタデータ2 (ステータス)': '承認済',
        },
      },
      {
        id: '1002',
        type: 'file',
        name: '第3四半期_営業実績一覧.xlsx',
        modified_at: '2026-10-23T15:45:00Z',
        size: 842000,
        metadata: {
          'メタデータ1 (分類)': '営業・売上',
          'メタデータ2 (ステータス)': '確認中',
        },
      },
      {
        id: '1003',
        type: 'file',
        name: '新プロダクト仕様書_v2.docx',
        modified_at: '2026-10-22T09:12:00Z',
        size: 2150000,
        metadata: {
          'メタデータ1 (分類)': '開発仕様',
          'メタデータ2 (ステータス)': '作成中',
        },
      },
      {
        id: '1004',
        type: 'file',
        name: '契約書雛形_秘密保持契約.pdf',
        modified_at: '2026-10-20T17:00:00Z',
        size: 450000,
        metadata: {
          'メタデータ1 (分類)': '法務・契約',
          'メタデータ2 (ステータス)': '正式版',
        },
      },
      {
        id: '1005',
        type: 'folder',
        name: 'デザイン素材アーカイブ',
        modified_at: '2026-10-19T11:20:00Z',
        size: 0,
        metadata: {
          'メタデータ1 (分類)': 'マーケティング',
          'メタデータ2 (ステータス)': '保管済',
        },
      },
    ];

    setLoading(false);
    elements.searchInput.disabled = false;
    elements.exportCsvBtn.disabled = false;
    elements.searchInput.value = '';

    filterAndRenderTable();
    showBanner('デモ表示中', 'デモデータを読み込みました。「ファイル名 メタデータ1 メタデータ2」の表示や絞り込み、CSV保存をテストできます。', 'info');
  }, 400);
}

// フォルダIDの抽出（URLが入力された場合でもIDのみを取り出す）
function parseFolderId(input) {
  const trimmed = input.trim();
  // https://app.box.com/folder/1234567890 などのURL形式に対応
  const match = trimmed.match(/folder\/([0-9]+)/);
  if (match) return match[1];
  // 末尾が数字のみ
  const numericOnly = trimmed.match(/([0-9]+)$/);
  if (numericOnly) return numericOnly[1];
  return trimmed;
}

// メタデータ取得メインフロー
async function handleFetchMetadata() {
  const token = elements.devTokenInput.value.trim();
  const rawFolderId = elements.folderIdInput.value.trim();
  const folderId = parseFolderId(rawFolderId);

  if (!token || !folderId) {
    showBanner('入力エラー', '開発者トークンとフォルダIDを入力してください。', 'warning');
    return;
  }

  // 設定をローカルストレージに保存
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.FOLDER_ID, rawFolderId);

  hideBanner();
  setLoading(true, 'フォルダ内のアイテム一覧を取得中...');

  try {
    // 1. フォルダ内アイテムの取得
    const folderItems = await fetchFolderItems(folderId, token);

    if (folderItems.length === 0) {
      state.items = [];
      state.metadataKeys = [];
      renderEmptyFolder();
      setLoading(false);
      return;
    }

    setLoading(true, `全 ${folderItems.length} 件のアイテムのメタデータを取得中...`);

    // 2. 各アイテムのメタデータを取得（並行処理）
    const itemsWithMeta = await fetchAllMetadata(folderItems, token);

    // 3. 検出されたメタデータキーを集約
    const detectedKeys = new Set();
    itemsWithMeta.forEach(item => {
      Object.keys(item.metadata || {}).forEach(k => {
        if (!INTERNAL_META_KEYS.has(k)) {
          detectedKeys.add(k);
        }
      });
    });

    state.items = itemsWithMeta;
    state.metadataKeys = Array.from(detectedKeys);

    setLoading(false);
    elements.searchInput.disabled = false;
    elements.exportCsvBtn.disabled = false;
    elements.searchInput.value = '';

    filterAndRenderTable();

    showBanner('取得完了', `${folderItems.length} 件のアイテムを取得しました。メタデータキー: ${state.metadataKeys.length > 0 ? state.metadataKeys.join(', ') : 'なし'}`, 'success');
  } catch (error) {
    console.error('Fetch error:', error);
    setLoading(false);
    handleApiError(error);
  }
}

// Box API: フォルダ内のアイテム一覧を取得
async function fetchFolderItems(folderId, token) {
  const url = `https://api.box.com/2.0/folders/${folderId}/items?fields=id,type,name,modified_at,size&limit=1000`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw { status: response.status, statusText: response.statusText, response };
  }

  const data = await response.json();
  return data.entries || [];
}

// Box API: アイテムのメタデータをすべて取得
async function fetchAllMetadata(items, token) {
  // 並行制限（最大6並行）で取得
  const concurrency = 6;
  const results = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item) => {
      const metadata = await fetchSingleItemMetadata(item, token);
      return {
        ...item,
        metadata: metadata || {},
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // プログレス更新
    elements.loadingText.textContent = `メタデータを取得中... (${Math.min(i + concurrency, items.length)} / ${items.length})`;
  }

  return results;
}

// 単一アイテムのメタデータを取得
async function fetchSingleItemMetadata(item, token) {
  const resourceType = item.type === 'folder' ? 'folders' : 'files';
  const url = `https://api.box.com/2.0/${resourceType}/${item.id}/metadata`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 404) {
      // メタデータが付与されていない場合は404が返る
      return {};
    }

    if (!res.ok) {
      return {};
    }

    const data = await res.json();
    // entries配列に各テンプレートのメタデータが入る
    const combined = {};
    if (data.entries && Array.isArray(data.entries)) {
      data.entries.forEach(templateInstance => {
        Object.entries(templateInstance).forEach(([key, val]) => {
          if (!INTERNAL_META_KEYS.has(key)) {
            combined[key] = val;
          }
        });
      });
    }
    return combined;
  } catch (err) {
    console.warn(`アイテム ${item.name} (${item.id}) のメタデータ取得失敗:`, err);
    return {};
  }
}

// テーブル描画 & 検索フィルタリング
function filterAndRenderTable() {
  const query = elements.searchInput.value.trim().toLowerCase();

  const filtered = state.items.filter(item => {
    if (!query) return true;
    if (item.name.toLowerCase().includes(query)) return true;
    // メタデータの値も検索対象
    return Object.values(item.metadata || {}).some(val => 
      String(val).toLowerCase().includes(query)
    );
  });

  elements.itemCountBadge.textContent = `${filtered.length} 件`;

  if (filtered.length === 0 && state.items.length > 0) {
    elements.metadataTable.classList.add('hidden');
    elements.noMatchState.classList.remove('hidden');
    return;
  }

  elements.noMatchState.classList.add('hidden');
  elements.metadataTable.classList.remove('hidden');

  renderTableHeader();
  renderTableBody(filtered);
}

// ヘッダー行を描画
function renderTableHeader() {
  const thead = elements.tableHead;
  thead.innerHTML = '';

  const tr = document.createElement('tr');

  // 種別
  const thType = document.createElement('th');
  thType.style.width = '40px';
  thType.textContent = '種別';
  tr.appendChild(thType);

  // ファイル名
  const thName = document.createElement('th');
  thName.textContent = 'ファイル名';
  tr.appendChild(thName);

  // 検出されたメタデータ列（メタデータ1, メタデータ2, ...）
  if (state.metadataKeys.length === 0) {
    const thNoMeta = document.createElement('th');
    thNoMeta.textContent = 'メタデータ';
    tr.appendChild(thNoMeta);
  } else {
    state.metadataKeys.forEach(key => {
      const th = document.createElement('th');
      th.textContent = key;
      tr.appendChild(th);
    });
  }

  // 更新日時
  const thDate = document.createElement('th');
  thDate.textContent = '更新日時';
  tr.appendChild(thDate);

  thead.appendChild(tr);
}

// ボディ行を描画
function renderTableBody(items) {
  const tbody = elements.tableBody;
  tbody.innerHTML = '';

  items.forEach(item => {
    const tr = document.createElement('tr');

    // 1. アイコン
    const tdIcon = document.createElement('td');
    const isFolder = item.type === 'folder';
    tdIcon.innerHTML = isFolder
      ? `<span class="item-icon folder" title="フォルダ">📁</span>`
      : `<span class="item-icon file" title="ファイル">📄</span>`;
    tr.appendChild(tdIcon);

    // 2. ファイル名 (Boxへのリンク + AI要約ボタン)
    const tdName = document.createElement('td');
    const boxLink = isFolder
      ? `https://app.box.com/folder/${item.id}`
      : `https://app.box.com/file/${item.id}`;

    const cellDiv = document.createElement('div');
    cellDiv.className = 'file-cell';

    const linkEl = document.createElement('a');
    linkEl.href = boxLink;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener';
    linkEl.className = 'file-link';
    linkEl.title = 'Boxで開く';
    linkEl.textContent = item.name;
    cellDiv.appendChild(linkEl);

    // ファイルの場合のみ「✨ AI要約」ボタンを表示
    if (!isFolder) {
      const aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'btn-ai-summary';
      aiBtn.title = 'Box AI でこの文書を要約';
      aiBtn.innerHTML = `<span>✨</span> 要約`;
      aiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAiSummaryModal(item);
      });
      cellDiv.appendChild(aiBtn);
    }

    tdName.appendChild(cellDiv);
    tr.appendChild(tdName);

    // 3. メタデータカラム
    if (state.metadataKeys.length === 0) {
      const tdEmptyMeta = document.createElement('td');
      tdEmptyMeta.innerHTML = `<span class="meta-empty">なし</span>`;
      tr.appendChild(tdEmptyMeta);
    } else {
      state.metadataKeys.forEach(key => {
        const td = document.createElement('td');
        const val = item.metadata ? item.metadata[key] : undefined;
        if (val !== undefined && val !== null && val !== '') {
          td.innerHTML = `<span class="meta-value">${escapeHtml(String(val))}</span>`;
        } else {
          td.innerHTML = `<span class="meta-empty">—</span>`;
        }
        tr.appendChild(td);
      });
    }

    // 4. 更新日時
    const tdDate = document.createElement('td');
    tdDate.style.fontSize = '0.8rem';
    tdDate.style.color = 'var(--text-muted)';
    tdDate.textContent = formatDate(item.modified_at);
    tr.appendChild(tdDate);

    tbody.appendChild(tr);
  });
}

// フォルダ内が空の場合の表示
function renderEmptyFolder() {
  elements.metadataTable.classList.add('hidden');
  elements.noMatchState.classList.add('hidden');
  elements.initialState.classList.remove('hidden');
  elements.initialState.innerHTML = `
    <div class="empty-icon">📭</div>
    <h3>このフォルダにはアイテムがありません</h3>
    <p>指定されたBoxフォルダは空です。</p>
  `;
}

// CSVエクスポート機能 (UTF-8 BOM付き)
function exportTableToCsv() {
  if (state.items.length === 0) return;

  const headers = ['種別', '名前', ...state.metadataKeys, '更新日時', 'Boxリンク'];
  const rows = [headers];

  state.items.forEach(item => {
    const isFolder = item.type === 'folder';
    const link = isFolder ? `https://app.box.com/folder/${item.id}` : `https://app.box.com/file/${item.id}`;
    
    const row = [
      isFolder ? 'フォルダ' : 'ファイル',
      item.name,
      ...state.metadataKeys.map(k => (item.metadata && item.metadata[k] !== undefined) ? item.metadata[k] : ''),
      formatDate(item.modified_at),
      link,
    ];
    rows.push(row);
  });

  const csvContent = rows
    .map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  // BOM (0xEF, 0xBB, 0xBF) を付与してExcel等での文字化けを防止
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `box_metadata_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ローディング状態の制御
function setLoading(isLoading, text = '') {
  state.isLoading = isLoading;
  if (isLoading) {
    elements.initialState.classList.add('hidden');
    elements.metadataTable.classList.add('hidden');
    elements.noMatchState.classList.add('hidden');
    elements.loadingState.classList.remove('hidden');
    if (text) elements.loadingText.textContent = text;
    elements.fetchBtn.disabled = true;
  } else {
    elements.loadingState.classList.add('hidden');
    elements.fetchBtn.disabled = false;
  }
}

// エラーハンドリング
function handleApiError(error) {
  let title = '通信エラー';
  let message = 'Box APIへのリクエストに失敗しました。';

  if (!error.status) {
    // ネットワークエラー、CORSエラー
    title = '通信 / CORS エラー';
    message = 'Box APIへ接続できませんでした。Box Developer Consoleの「構成」タブにある「CORSドメイン」に「http://localhost:8000」が追加されているかご確認ください。また、開発用ローカルサーバー (python serve.py) 経由で開いていることを確認してください。';
  } else if (error.status === 401) {
    title = '認証エラー (401)';
    message = '開発者トークンが無効または有効期限（1時間）が切れています。Box Developer Consoleで再発行したトークンを入力してください。';
  } else if (error.status === 404) {
    title = 'フォルダが見つかりません (404)';
    message = '指定されたフォルダIDが存在しないか、このトークンのユーザーに閲覧権限がありません。フォルダIDを確認してください。';
  } else if (error.status === 403) {
    title = 'アクセス拒否 (403)';
    message = 'このフォルダに対するアクセス権限が不足しています。アプリのスコープ設定やコラボレーション権限をご確認ください。';
  } else {
    message = `エラーが発生しました (${error.status}: ${error.statusText})`;
  }

  showBanner(title, message, 'error');
}

// バナー表示
function showBanner(title, message, type = 'error') {
  elements.bannerTitle.textContent = title;
  elements.bannerMessage.textContent = message;
  elements.statusBanner.className = `alert-banner ${type}`;
  elements.statusBanner.classList.remove('hidden');
}

function hideBanner() {
  elements.statusBanner.classList.add('hidden');
}

// 簡易トースト通知
function showToast(message, type = 'info') {
  showBanner('情報', message, type);
  setTimeout(hideBanner, 3000);
}

// 日時フォーマット (YYYY/MM/DD HH:mm)
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
  } catch {
    return '—';
  }
}

// HTMLエスケープ
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------------------------------------------
// Box AI 連携ロジック (アイデア 1: ワンクリックAI文書要約)
// ----------------------------------------------------

// デモ用プリセット要約データ
const DEMO_AI_SUMMARIES = {
  '1001': '【事業企画書 要約】\n1. 2026年度の全社DX推進方針および新規事業開発のロードマップを策定。\n2. クラウドインフラの統合とBoxメタデータを活用した文書管理の自動化を計画。\n3. 年間投資対効果として業務時間を前年比25%削減することを目標としている。',
  '1002': '【営業実績一覧 要約】\n1. 第3四半期の売上達成率は目標比108%と好調に推移。\n2. 特にクラウド移行支援サービスが前年同期比で40%増収を記録。\n3. 一方で製造業セグメントの案件クロージングに遅れがあり、次期への対策が急務。',
  '1003': '【仕様書 v2 要約】\n1. WebフロントエンドとBox REST API連携による動的メタデータ描画仕様を定義。\n2. ユーザー認証およびCCGサーバー間認証によるセキュリティ要件を追記。\n3. リアルタイム検索フィルターとCSV出力機能の要件を満たす設計。',
  '1004': '【秘密保持契約書 要約】\n1. 業務委託に伴う機密情報の定義と開示目的の限定を明記。\n2. 契約の有効期間は締結日より2年間、情報の秘密保持義務は終了後3年間継続。\n3. 違反時の損害賠償責任および管轄裁判所に関する条項を整備。',
};

// AI要約モーダルを開く
async function openAiSummaryModal(item) {
  elements.modalFileName.textContent = item.name;
  elements.summaryText.textContent = '';
  elements.modalError.classList.add('hidden');
  elements.modalSummaryContent.classList.add('hidden');
  elements.modalLoading.classList.remove('hidden');
  elements.copySummaryBtn.disabled = true;
  elements.aiModal.classList.remove('hidden');

  try {
    // デモアイテムの場合
    if (DEMO_AI_SUMMARIES[item.id]) {
      await new Promise(resolve => setTimeout(resolve, 800)); // AI思考アニメーション
      displaySummaryResult(DEMO_AI_SUMMARIES[item.id]);
      return;
    }

    // 本番Box API呼び出し
    const token = elements.devTokenInput.value.trim();
    if (!token) {
      throw { message: '開発者トークンが入力されていません。' };
    }

    const summary = await requestBoxAiSummary(item.id, token);
    displaySummaryResult(summary);
  } catch (err) {
    console.error('Box AI Error:', err);
    elements.modalLoading.classList.add('hidden');
    elements.modalError.classList.remove('hidden');

    let msg = 'Box AI APIの呼び出しに失敗しました。';
    if (err.status === 403) {
      msg = 'Box AIの利用権限がありません。Box Developer Consoleの「構成」タブ ➔「アプリケーションスコープ」で「Box AIの管理と使用 (Manage Box AI)」にチェックを入れ、開発者トークンを再生成してください。';
    } else if (err.status === 404) {
      msg = '対象ファイルの内容が見つからないか、AI解析に対応していないファイル形式です（対応例: PDF, DOCX, TXTなど）。';
    } else if (err.message) {
      msg = err.message;
    }
    elements.modalErrorMessage.textContent = msg;
  }
}

// Box AI API: POST /2.0/ai/ask を呼び出し
async function requestBoxAiSummary(fileId, token) {
  const url = 'https://api.box.com/2.0/ai/ask';
  
  const bodyData = {
    mode: 'single_item_qa',
    prompt: 'このドキュメントの要点を日本語で3行以内でわかりやすく要約してください。箇条書き形式で重要なポイントを整理してください。',
    items: [
      {
        id: String(fileId),
        type: 'file',
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      statusText: response.statusText,
      message: errorData.message || `APIエラー (${response.status})`,
    };
  }

  const result = await response.json();
  return result.answer || '要約を取得できませんでした。';
}

// 要約結果をモーダルに表示
function displaySummaryResult(text) {
  elements.modalLoading.classList.add('hidden');
  elements.summaryText.textContent = text;
  elements.modalSummaryContent.classList.remove('hidden');
  elements.copySummaryBtn.disabled = false;
}

// AIモーダルを閉じる
function closeAiModal() {
  elements.aiModal.classList.add('hidden');
}
