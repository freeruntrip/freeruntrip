/* FreeRunTrip: authenticated social feed, matching frt_social_* SQL. */
(() => {
  'use strict';
  const client = window.freeRunTripSupabase;
  if (!client) { console.error('Supabase must load before frt-social.js'); return; }
  const bucket = client.storage.from('frt-social-images');
  let generation = 0;
  let scope = 'mine';
  let root;
  let busy = false;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const checked = result => { if (result.error) throw result.error; return result.data; };
  async function user() {
    const data = checked(await client.auth.getUser());
    if (!data?.user) throw new Error('로그인이 필요해요.');
    return data.user;
  }
  async function names(ids) {
    if (!ids.length) return new Map();
    const rows = checked(await client.rpc('frt_social_author_names', {
      author_ids: [...new Set(ids)]
    }));
    return new Map((rows || []).map(row => [row.user_id, row.username]));
  }
  const author = (map, id) => map.get(id) ? '@' + map.get(id) : '사용자';
  function button(text, action) {
    const node = el('button', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function message(error) { console.error('FreeRunTrip social:', error); return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'; }

  // Called only by the explicit Publish action; never migrates private records.
  window.frtSocialPublish = async function ({ recordId, dataUrl, caption, owner }) {
    const current = await user();
    if (current.id !== owner) throw new Error('계정이 변경되었습니다. 다시 게시해 주세요.');
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size > 15728640) throw new Error('게시 이미지가 15MB를 초과합니다.');
    const path = `${current.id}/${crypto.randomUUID()}.png`;
    checked(await bucket.upload(path, blob, { contentType: 'image/png', upsert: false }));
    // Do not delete an upload on an ambiguous network failure: the DB write may have committed.
    const confirmed = await user();
    if (confirmed.id !== current.id) throw new Error('계정이 변경되었습니다. 다시 게시해 주세요.');
    checked(await client.from('frt_social_posts').upsert({
      user_id: current.id, source_record_id: String(recordId), image_path: path,
      caption: String(caption || '').slice(0, 2200), updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,source_record_id' }).select('id').single());
    await refresh();
  };

  async function comments(post, panel, token) {
    panel.replaceChildren(el('p', '댓글을 불러오고 있어요.'));
    try {
      const rows = checked(await client.from('frt_social_comments')
        .select('id,user_id,body,created_at').eq('post_id', post.id)
        .order('created_at', { ascending: false }).order('id').limit(100));
      const authors = await names(rows.map(row => row.user_id));
      if (token !== generation) return;
      panel.replaceChildren();
      if (!rows.length) panel.append(el('p', '첫 댓글을 남겨보세요.'));
      for (const row of rows.slice().reverse()) {
        const item = el('p');
        item.append(el('strong', author(authors, row.user_id)), document.createTextNode(' ' + row.body));
        panel.append(item);
      }
      if (rows.length === 100) panel.prepend(el('p', '최근 댓글 100개를 표시해요.'));
    } catch (error) { if (token === generation) panel.replaceChildren(el('p', message(error))); }
  }

  async function card(post, current, authors, token) {
    const article = el('article', undefined, 'frt-social-card');
    article.append(el('strong', author(authors, post.user_id)), el('small', new Date(post.created_at).toLocaleString()));
    const signed = await bucket.createSignedUrl(post.image_path, 3600);
    if (signed.error) article.append(el('p', '사진을 불러오지 못했어요.'));
    else {
      const img = el('img'); img.src = signed.data.signedUrl; img.alt = '공유한 러닝 기록'; img.loading = 'lazy';
      article.append(img);
    }
    if (post.caption) article.append(el('p', post.caption));
    const status = el('p', '', 'frt-social-status'); status.setAttribute('role', 'status');
    const actions = el('div', undefined, 'frt-social-actions');
    let liked = false;
    const like = button('좋아요 불러오는 중', async () => {
      like.disabled = true; status.textContent = '';
      try {
        const active = await user();
        if (active.id !== current.id || token !== generation) return;
        if (liked) checked(await client.from('frt_social_likes').delete().eq('post_id', post.id).eq('user_id', current.id));
        else checked(await client.from('frt_social_likes').upsert({ post_id: post.id, user_id: current.id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true }));
        await loadLikes();
      } catch (error) { status.textContent = message(error); }
      finally { like.disabled = false; }
    });
    async function loadLikes() {
      const [count, mine] = await Promise.all([
        client.from('frt_social_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        client.from('frt_social_likes').select('user_id').eq('post_id', post.id).eq('user_id', current.id)
      ]);
      checked(count); checked(mine);
      liked = mine.data.length > 0;
      like.textContent = `${liked ? '♥' : '♡'} 좋아요 ${count.count || 0}`;
      like.setAttribute('aria-pressed', String(liked));
    }
    const panel = el('div');
    const area = el('div'); area.hidden = true;
    const toggle = button('댓글', async () => {
      area.hidden = !area.hidden;
      toggle.setAttribute('aria-expanded', String(!area.hidden));
      if (!area.hidden) await comments(post, panel, token);
    });
    toggle.setAttribute('aria-expanded', 'false');
    const form = el('form');
    const input = el('textarea'); input.maxLength = 1000; input.required = true;
    input.placeholder = '댓글을 남겨보세요'; input.setAttribute('aria-label', '댓글 내용');
    const submit = el('button', '등록'); submit.type = 'submit';
    form.append(input, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const body = input.value.trim(); if (!body) return;
      submit.disabled = true; status.textContent = '';
      try {
        const active = await user();
        if (active.id !== current.id || token !== generation) return;
        checked(await client.from('frt_social_comments').insert({ post_id: post.id, user_id: current.id, body }));
        input.value = ''; await comments(post, panel, token); await loadCount();
      } catch (error) { status.textContent = message(error); }
      finally { submit.disabled = false; }
    });
    async function loadCount() {
      const result = await client.from('frt_social_comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
      checked(result); toggle.textContent = `댓글 ${result.count || 0}`;
    }
    area.append(panel, form); actions.append(like, toggle); article.append(actions, area, status);
    try { await Promise.all([loadLikes(), loadCount()]); }
    catch (error) { status.textContent = message(error); }
    return article;
  }

  async function refresh() {
    if (!root) return;
    const token = ++generation;
    const list = root.querySelector('.frt-social-list');
    list.replaceChildren(el('p', '공유 게시물을 불러오고 있어요.'));
    try {
      const session = checked(await client.auth.getSession());
      const current = session.session?.user;
      if (!current) { if (token === generation) list.replaceChildren(el('p', '로그인하면 공유 게시물을 볼 수 있어요.')); return; }
      let query = client.from('frt_social_posts').select('id,user_id,image_path,caption,created_at').order('created_at', { ascending: false }).order('id').limit(20);
      if (scope === 'mine') query = query.eq('user_id', current.id);
      const posts = checked(await query);
      const authors = await names(posts.map(post => post.user_id));
      const cards = await Promise.all(posts.map(post => card(post, current, authors, token)));
      if (token !== generation) return;
      list.replaceChildren(...cards);
      if (!cards.length) list.append(el('p', scope === 'mine' ? '공유한 게시물이 없어요. 기록 편집에서 게시 버튼을 눌러주세요.' : '아직 공유한 게시물이 없어요.'));
      if (cards.length === 20) list.append(el('p', '최근 게시물 20개를 표시해요.'));
    } catch (error) { if (token === generation) list.replaceChildren(el('p', message(error))); }
  }
  function mount() {
    const anchor = document.getElementById('profileRecentRuns');
    if (!anchor) return;
    const style = el('style');
    style.textContent = `.frt-social{margin-top:24px}.frt-social nav,.frt-social-actions{display:flex;gap:10px;margin:12px 0;flex-wrap:wrap}.frt-social button{padding:10px 14px;border:1px solid #d1d5db;border-radius:12px;background:#fff;color:#111;cursor:pointer}.frt-social button[aria-pressed=true]{color:#d62954;border-color:#d62954}.frt-social button:disabled{opacity:.5}.frt-social-card{padding:16px;margin:16px 0;border:1px solid #ddd;border-radius:16px;background:#fff;color:#111;overflow:hidden}.frt-social-card small{display:block;margin:6px 0 12px;color:#666}.frt-social-card img{display:block;width:100%;height:auto;border-radius:10px}.frt-social-card p{white-space:pre-wrap;overflow-wrap:anywhere}.frt-social-card textarea{box-sizing:border-box;width:100%;min-height:70px;font:inherit;padding:10px;border:1px solid #ccc;border-radius:10px}.frt-social-status{font-size:13px;color:#9b2534}`;
    document.head.append(style);
    root = el('section', undefined, 'frt-social'); root.append(el('h3', '공유 게시물'));
    const nav = el('nav'); nav.setAttribute('aria-label', '게시물 보기');
    const mine = button('내 게시물', () => { scope = 'mine'; update(); });
    const all = button('모두의 게시물', () => { scope = 'all'; update(); });
    function update() { mine.setAttribute('aria-pressed', String(scope === 'mine')); all.setAttribute('aria-pressed', String(scope === 'all')); refresh(); }
    nav.append(mine, all, button('새로고침', () => refresh()));
    root.append(nav, el('div', undefined, 'frt-social-list')); anchor.after(root);
    update();
    // Defer Supabase queries outside its auth callback.
    client.auth.onAuthStateChange(() => { ++generation; root.querySelector('.frt-social-list').replaceChildren(); setTimeout(refresh, 0); });
    const screen = document.getElementById('profileFeedScreen');
    if (screen) new MutationObserver(() => {
      if (!screen.classList.contains('hidden') && !busy) {
        busy = true; refresh().finally(() => { busy = false; });
      }
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
