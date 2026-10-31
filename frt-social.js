/* FreeRunTrip: authenticated social feed, matching frt_social_* SQL. */
(() => {
  'use strict';
  const client = window.freeRunTripSupabase;
  if (!client) { console.error('Supabase must load before frt-social.js'); return; }
  const bucket = client.storage.from('frt-social-images');
  let generation = 0;
  let scope = 'recommended';
  const shownCounts = new Map();
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
  const author = (map, id) => map.get(id) || '사용자';

  function accountIdentity(map, id) {
    const identity = el(
      'span',
      undefined,
      'frt-account-identity'
    );

    const avatar = el(
      'span',
      undefined,
      'frt-account-identity-avatar'
    );

    avatar.setAttribute('aria-hidden', 'true');
    paintAvatar(avatar, null);

    identity.append(
      avatar,
      el('strong', author(map, id), 'frt-account-identity-name')
    );

    // 계정명이 실제 화면에 나타날 때 사진을 조회한다.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;

      observer.disconnect();
      void loadAvatar(avatar, id);
    });

    observer.observe(identity);

    return identity;
  }
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
  const postReactionViews = new Set();
  let reactionAccountEpoch = 0;

  // 같은 게시물을 표시하는 화면들의 반응 갱신
  async function syncPostReactions(postId) {
    const jobs = [];

    for (const view of postReactionViews) {
      if (!view.valid()) {
        postReactionViews.delete(view);
      } else if (
        view.node.isConnected &&
        String(view.postId) === String(postId)
      ) {
        jobs.push(view.refresh());
      }
    }

    await Promise.allSettled(jobs);
  }

  // 홈과 프로필에서 함께 사용하는 좋아요·댓글
  async function appendPostReactions(
    post,
    current,
    token,
    container
  ) {
    const valid = () =>
      typeof token === 'function'
        ? token()
        : token === generation;

    const wrap = el('div', undefined, 'frt-post-reactions');
    const status = el('p', '', 'frt-social-status');

    status.setAttribute('role', 'status');

    const actions = el('div', undefined, 'frt-social-actions');
    const panel = el('div');
    const area = el('div');

    area.hidden = true;

    let liked = false;
    let likesRequest = 0;
    let countRequest = 0;

    const like = button('좋아요 불러오는 중', async () => {
      like.disabled = true;
      status.textContent = '';

      try {
        const active = await user();

        if (active.id !== current.id || !valid()) return;

        if (liked) {
          checked(
            await client.from('frt_social_likes')
              .delete()
              .eq('post_id', post.id)
              .eq('user_id', current.id)
          );
        } else {
          checked(
            await client.from('frt_social_likes').upsert(
              {
                post_id: post.id,
                user_id: current.id
              },
              {
                onConflict: 'post_id,user_id',
                ignoreDuplicates: true
              }
            )
          );
        }

        if (!valid()) return;

        await syncPostReactions(post.id);
      } catch (error) {
        if (valid()) status.textContent = message(error);
      } finally {
        like.disabled = false;
      }
    });

    async function loadLikes() {
      const request = ++likesRequest;

      const [count, mine] = await Promise.all([
        client.from('frt_social_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id),

        client.from('frt_social_likes')
          .select('user_id')
          .eq('post_id', post.id)
          .eq('user_id', current.id)
      ]);

      checked(count);
      checked(mine);

      if (!valid() || request !== likesRequest) return;

      liked = (mine.data || []).length > 0;

      like.textContent =
        `${liked ? '♥' : '♡'} 좋아요 ${count.count || 0}`;

      like.setAttribute('aria-pressed', String(liked));
    }

    const toggle = button('댓글', async () => {
      if (!valid()) return;

      area.hidden = !area.hidden;

      toggle.setAttribute(
        'aria-expanded',
        String(!area.hidden)
      );

      if (!area.hidden) {
        await comments(post, panel, valid);
      }
    });

    toggle.setAttribute('aria-expanded', 'false');

    const form = el('form');
    const input = el('textarea');

    input.maxLength = 1000;
    input.required = true;
    input.placeholder = '댓글을 남겨보세요';
    input.setAttribute('aria-label', '댓글 내용');

    const submit = el('button', '등록');
    submit.type = 'submit';

    form.append(input, submit);

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const body = input.value.trim();

      if (!body || submit.disabled) return;

      submit.disabled = true;
      status.textContent = '';

      try {
        const active = await user();

        if (active.id !== current.id || !valid()) return;

        checked(
          await client.from('frt_social_comments').insert({
            post_id: post.id,
            user_id: current.id,
            body
          })
        );

        if (!valid()) return;

        input.value = '';

        await syncPostReactions(post.id);
      } catch (error) {
        if (valid()) status.textContent = message(error);
      } finally {
        submit.disabled = false;
      }
    });

    async function loadCount() {
      const request = ++countRequest;

      const result = await client
        .from('frt_social_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      checked(result);

      if (valid() && request === countRequest) {
        toggle.textContent = `댓글 ${result.count || 0}`;
      }
    }

    async function refreshReactions() {
      try {
        await Promise.all([
          loadLikes(),
          loadCount(),
          area.hidden
            ? Promise.resolve()
            : comments(post, panel, valid)
        ]);
      } catch (error) {
        if (valid()) status.textContent = message(error);
      }
    }

    area.append(panel, form);
    actions.append(like, toggle);
    wrap.append(actions, area, status);
    container.append(wrap);

    postReactionViews.add({
      node: wrap,
      postId: post.id,
      valid,
      refresh: refreshReactions
    });

    await refreshReactions();

    return wrap;
  }
  async function comments(post, panel, token) {
    const isCurrent = () =>
      typeof token === 'function'
        ? token()
        : token === generation;

    panel.replaceChildren(el('p', '댓글을 불러오고 있어요.'));
    try {
      const rows = checked(await client.from('frt_social_comments')
        .select('id,user_id,body,created_at').eq('post_id', post.id)
        .order('created_at', { ascending: false }).order('id').limit(100));
      const authors = await names(rows.map(row => row.user_id));
      if (!isCurrent()) return;
      panel.replaceChildren();
      if (!rows.length) panel.append(el('p', '첫 댓글을 남겨보세요.'));
      for (const row of rows.slice().reverse()) {
        const item = el('p');
        item.append(
          accountIdentity(authors, row.user_id),
          document.createTextNode(' ' + row.body)
        );
        panel.append(item);
      }
      if (rows.length === 100) panel.prepend(el('p', '최근 댓글 100개를 표시해요.'));
    } catch (error) {
      if (isCurrent()) {
        panel.replaceChildren(el('p', message(error)));
      }
    }
  }

  async function card(
    post,
    current,
    authors,
    token
  ) {
    const article = el('article', undefined, 'frt-social-card');
        const authorRow = el(
      'div',
      undefined,
      'frt-social-author-row'
    );

    authorRow.append(
      accountIdentity(authors, post.user_id)
    );

    const followStatus = el(
      'p',
      '',
      'frt-social-status'
    );
    followStatus.setAttribute('role', 'status');

    // 본인 게시물에는 팔로우 버튼을 표시하지 않는다.
    if (post.user_id !== current.id) {
      let following = false;

      const followBtn = button('확인 중', async () => {
        followBtn.disabled = true;
        followStatus.textContent = '';

        try {
          const active = await user();

          if (
            active.id !== current.id ||
            token !== generation
          ) {
            return;
          }

          following =
            followBtn.getAttribute('aria-pressed') === 'true';
          if (following) {
            checked(
              await client
                .from('frt_social_follows')
                .delete()
                .eq('follower_id', current.id)
                .eq('following_id', post.user_id)
            );
          } else {
            checked(
              await client
                .from('frt_social_follows')
                .upsert(
                  {
                    follower_id: current.id,
                    following_id: post.user_id
                  },
                  {
                    onConflict: 'follower_id,following_id',
                    ignoreDuplicates: true
                  }
                )
            );
          }

          if (token !== generation) return;

          await refresh();
        } catch (error) {
          if (token === generation) {
            followStatus.textContent = message(error);
          }
        } finally {
          followBtn.disabled = false;
        }
      });

      followBtn.className = 'frt-social-follow-btn';
      followBtn.disabled = true;
      authorRow.append(followBtn);

      try {
        const rows = checked(
          await client
            .from('frt_social_follows')
            .select('following_id')
            .eq('follower_id', current.id)
            .eq('following_id', post.user_id)
        ) || [];

        following = rows.length > 0;

        followBtn.textContent = following
          ? '팔로잉 · 취소'
          : '팔로우';

        followBtn.setAttribute(
          'aria-pressed',
          String(following)
        );

        followBtn.setAttribute(
          'aria-label',
          `${author(authors, post.user_id)} ${
            following ? '팔로우 취소' : '팔로우'
          }`
        );

        followBtn.disabled = false;
      } catch (error) {
        followBtn.textContent = '확인 실패';
        followStatus.textContent = message(error);
      }
    }

    article.append(
      authorRow,
      el('small', new Date(post.created_at).toLocaleString()),
      followStatus
    );
    const signed = await bucket.createSignedUrl(post.image_path, 3600);
    if (signed.error) article.append(el('p', '사진을 불러오지 못했어요.'));
    else {
            const img = el('img');

      img.src = signed.data.signedUrl;
      img.alt = '공유한 러닝 기록';
      img.loading = 'lazy';
      img.classList.add('frt-post-media');

      article.append(img);
    }
    if (post.caption) article.append(el('p', post.caption));
    await appendPostReactions(post, current, token, article);
    return article;
  }

  async function refresh() {
    if (!root) return;

    const token = ++generation;
    const selectedScope = scope;
    const list = root.querySelector('.frt-social-list');

    list.replaceChildren(
      el('p', '공유 게시물을 불러오고 있어요.')
    );

    try {
      const session = checked(
        await client.auth.getSession()
      );
      const current = session.session?.user;

      if (token !== generation) return;

      if (!current) {
        list.replaceChildren(
          el('p', '로그인하면 공유 게시물을 볼 수 있어요.')
        );
        return;
      }

      let query = client
        .from('frt_social_posts')
        .select('id,user_id,image_path,caption,created_at')
        .order('created_at', { ascending: false })
        .order('id');

      if (selectedScope === 'following') {
        const follows = checked(
          await client
            .from('frt_social_follows')
            .select('following_id')
            .eq('follower_id', current.id)
        ) || [];

        if (token !== generation) return;

        const ids = follows.map(row => row.following_id);

        if (!ids.length) {
          list.replaceChildren(
            el(
              'p',
              '아직 팔로우한 사용자가 없어요. 추천 피드에서 관심 있는 사용자를 찾아보세요.'
            )
          );
          return;
        }

        query = query.in('user_id', ids).limit(20);
      } else {
        query = query.limit(60);
      }

      let posts = checked(await query) || [];

      if (token !== generation) return;

      if (selectedScope === 'recommended') {
        const now = Date.now();

        const candidates = await Promise.all(
          posts.map(async post => {
            const [likes, commentsResult] = await Promise.all([
              client
                .from('frt_social_likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id),

              client
                .from('frt_social_comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id)
            ]);

            checked(likes);
            checked(commentsResult);

            const ageHours = Math.max(
              0,
              (now - new Date(post.created_at).getTime()) /
                3600000
            );

            const freshness = 1 / (1 + ageHours / 24);
            const reactions =
              (likes.count || 0) +
              (commentsResult.count || 0) * 2;

            const reactionScore =
              Math.min(Math.log1p(reactions), 3) * 0.2;

            const shown = shownCounts.get(post.id) || 0;

            return {
              post,
              score: freshness + reactionScore - shown * 0.15
            };
          })
        );

        if (token !== generation) return;

        const authorCounts = new Map();
        const selected = [];

        while (candidates.length && selected.length < 20) {
          let bestIndex = 0;
          let bestScore = -Infinity;

          candidates.forEach((candidate, index) => {
            const authorCount =
              authorCounts.get(candidate.post.user_id) || 0;

            const score =
              candidate.score - authorCount * 0.6;

            if (score > bestScore) {
              bestScore = score;
              bestIndex = index;
            }
          });

          const chosen =
            candidates.splice(bestIndex, 1)[0].post;

          selected.push(chosen);

          authorCounts.set(
            chosen.user_id,
            (authorCounts.get(chosen.user_id) || 0) + 1
          );
        }

        posts = selected;
      }

      const authors = await names(
        posts.map(post => post.user_id)
      );

      if (token !== generation) return;

      const cards = await Promise.all(
        posts.map(post => card(post, current, authors, token))
      );

      if (token !== generation) return;

      list.replaceChildren(...cards);

      if (!cards.length) {
        list.append(
          el(
            'p',
            selectedScope === 'following'
              ? '팔로우한 사용자가 아직 공유한 게시물이 없어요.'
              : '아직 공유한 게시물이 없어요. 첫 러닝 이야기를 공개해보세요.'
          )
        );
      }

      if (selectedScope === 'recommended') {
        posts.forEach(post => {
          shownCounts.set(
            post.id,
            (shownCounts.get(post.id) || 0) + 1
          );
        });
      }

      if (cards.length === 20) {
        list.append(
          el(
            'p',
            selectedScope === 'following'
              ? '최근 게시물 20개를 표시해요.'
              : '최근 공개 게시물 중 추천 게시물 20개를 표시해요.'
          )
        );
      }
    } catch (error) {
      if (token === generation) {
        list.replaceChildren(el('p', message(error)));
      }
    }
  }
    function mountProfileFollows() {
    const screen = document.getElementById('profileFeedScreen');
    const count = document.getElementById('profileFollowers');
    const followersBtn =
      document.getElementById('frtProfileFollowersBtn');
    const ownerActions =
      document.getElementById('frtProfileOwnerActions');
    const followingBtn =
      document.getElementById('frtProfileFollowingBtn');

    const dialog = document.getElementById('frtFollowDialog');
    const title = document.getElementById('frtFollowDialogTitle');
    const status = document.getElementById('frtFollowDialogStatus');
    const list = document.getElementById('frtFollowDialogList');
    const more = document.getElementById('frtFollowDialogMore');

    if (
      !screen || !count || !followersBtn || !ownerActions ||
      !followingBtn || !dialog || !title || !status ||
      !list || !more
    ) return;

    let accountId = null;
    let accountVersion = 0;
    let countVersion = 0;
    let view = null;

    function clearList() {
      view = null;
      list.replaceChildren();
      status.textContent = '';
      more.hidden = true;
      more.disabled = false;
    }

    function setAccount(id) {
      if (id === accountId) return;

      accountId = id;
      accountVersion++;
      countVersion++;

      clearList();
      if (dialog.open) dialog.close();

      ownerActions.hidden = !id;
      followersBtn.disabled = !id;
      count.textContent = id ? '—' : '0';
    }

    async function refreshCount() {
      const id = accountId;
      const version = ++countVersion;
      if (!id) return;

      try {
        const value = checked(
          await client.rpc('frt_social_follower_count', {
            target_user_id: id
          })
        );

        if (version !== countVersion || id !== accountId) return;
        count.textContent = String(value ?? 0);
        followersBtn.title = '팔로워 목록 보기';
      } catch (error) {
        if (version !== countVersion || id !== accountId) return;
        count.textContent = '—';
        followersBtn.title = '팔로워 수를 불러오지 못했어요.';
        console.error('팔로워 수 조회 실패:', error);
      }
    }

    function isCurrent(state) {
      return (
        view === state &&
        dialog.open &&
        accountId === state.owner &&
        accountVersion === state.version
      );
    }

    function setListBusy(state, value) {
      state.busy = value;
      more.disabled = value;
      list.querySelectorAll('button').forEach(node => {
        node.disabled = value;
      });
    }

    async function loadPage(state) {
      if (!isCurrent(state) || state.busy) return;
      setListBusy(state, true);
      status.textContent = '목록을 불러오고 있어요.';

      try {
        const active = await user();
        if (!isCurrent(state)) return;

        if (active.id !== state.owner) {
          setAccount(active.id);
          void refreshCount();
          return;
        }

        let rows;

        if (state.kind === 'followers') {
          rows = checked(
            await client.rpc('frt_social_follower_list', {
              target_user_id: state.owner,
              page_offset: state.offset
            })
          ) || [];
        } else {
          const result = checked(
            await client
              .from('frt_social_follows')
              .select('following_id,created_at')
              .eq('follower_id', state.owner)
              .order('created_at', { ascending: false })
              .order('following_id')
              .range(state.offset, state.offset + 49)
          ) || [];

          rows = result.map(row => ({
            user_id: row.following_id
          }));
        }

        if (!isCurrent(state)) return;

        const authors = await names(rows.map(row => row.user_id));
        if (!isCurrent(state)) return;

        for (const row of rows) {
          if (state.seen.has(row.user_id)) continue;
          state.seen.add(row.user_id);

          const item = el('li');
          item.append(
            accountIdentity(authors, row.user_id)
          );

          if (state.kind === 'following') {
            const cancel = button('팔로우 취소', async () => {
              if (!isCurrent(state) || state.busy) return;

              setListBusy(state, true);
              status.textContent = '';

              try {
                const activeUser = await user();
                if (!isCurrent(state)) return;

                if (activeUser.id !== state.owner) {
                  setAccount(activeUser.id);
                  void refreshCount();
                  return;
                }

                checked(
                  await client
                    .from('frt_social_follows')
                    .delete()
                    .eq('follower_id', state.owner)
                    .eq('following_id', row.user_id)
                );

                if (!isCurrent(state)) return;

                // 삭제 후 첫 페이지부터 다시 읽어 누락을 방지한다.
                state.offset = 0;
                state.seen.clear();
                list.replaceChildren();
                more.hidden = true;

                setListBusy(state, false);
                await loadPage(state);
                void refresh();
              } catch (error) {
                if (isCurrent(state)) {
                  status.textContent = message(error);
                }
              } finally {
                if (isCurrent(state)) setListBusy(state, false);
              }
            });

            cancel.setAttribute(
              'aria-label',
              `${author(authors, row.user_id)} 팔로우 취소`
            );
            item.append(cancel);
          }

          list.append(item);
        }

        state.offset += rows.length;
        more.hidden = rows.length < 50;
        more.textContent = '더 보기';

        status.textContent = list.children.length
          ? ''
          : state.kind === 'followers'
            ? '아직 팔로워가 없어요.'
            : '아직 팔로우한 계정이 없어요.';
      } catch (error) {
        if (isCurrent(state)) {
          status.textContent = message(error);
          more.hidden = false;
          more.textContent = '다시 시도';
        }
      } finally {
        if (isCurrent(state)) setListBusy(state, false);
      }
    }

    function openList(kind) {
      if (!accountId) return;

      clearList();
      title.textContent =
        kind === 'followers' ? '팔로워' : '팔로잉 목록';
      list.setAttribute('aria-label', title.textContent);

      const state = {
        kind,
        owner: accountId,
        version: accountVersion,
        offset: 0,
        busy: false,
        seen: new Set()
      };

      view = state;
      if (!dialog.open) dialog.showModal();

      void loadPage(state);
      void refreshCount();
    }

    followersBtn.addEventListener('click', () => {
      openList('followers');
    });

    followingBtn.addEventListener('click', () => {
      openList('following');
    });

    more.addEventListener('click', () => {
      if (view) void loadPage(view);
    });

    dialog.addEventListener('close', () => {
      // 재열림 뒤 도착한 이전 close 이벤트는 무시한다.
      if (!dialog.open) clearList();
    });

    new MutationObserver(() => {
      if (!screen.classList.contains('hidden')) {
        void refreshCount();
      } else if (dialog.open) {
        clearList();
        dialog.close();
      }
    }).observe(screen, {
      attributes: true,
      attributeFilter: ['class']
    });

    ownerActions.hidden = true;
    followersBtn.disabled = true;
    count.textContent = '—';

    client.auth.onAuthStateChange((event, session) => {
      setAccount(session?.user?.id || null);

      // 인증 콜백 바깥에서 DB를 조회한다.
      setTimeout(() => {
        if (!accountId) {
          count.textContent = '0';
        } else {
          void refreshCount();
        }
      }, 0);
    });
  }
    const avatarBucket = client.storage.from('frt-profile-images');
  const avatarRequests = new WeakMap();

  function paintAvatar(node, src) {
  node.classList.add('frt-pin-avatar');

  const pin = el('span', undefined, 'frt-avatar-pin');
  node.replaceChildren(pin);

  if (!src) {
    pin.append(el('span', 'F', 'frt-avatar-letter'));
    return;
  }

  const img = el('img');
  img.alt = '프로필 사진';
  img.crossOrigin = 'anonymous';

  img.addEventListener('error', () => {
    if (node.contains(img)) paintAvatar(node, null);
  }, { once: true });

  img.addEventListener('load', () => {
    if (!node.contains(img)) return;

    try {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      const pixels = ctx.getImageData(
        0, 0, width, height
      ).data;

      let transparent = 0;
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = pixels[(y * width + x) * 4 + 3];

          if (alpha < 16) transparent++;

          if (alpha > 16) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }

      // 일반 사진은 기존 마커 모양으로 표시한다.
      if (
        transparent < width * height * 0.01 ||
        right < left ||
        bottom < top
      ) return;

      // 투명 이미지의 바깥 여백만 잘라낸다.
      const cropped = document.createElement('canvas');
      cropped.width = right - left + 1;
      cropped.height = bottom - top + 1;

      const croppedCtx = cropped.getContext('2d');
      if (!croppedCtx) return;

      croppedCtx.drawImage(
        canvas,
        left, top,
        cropped.width, cropped.height,
        0, 0,
        cropped.width, cropped.height
      );

      const croppedUrl = cropped.toDataURL('image/png');

      pin.classList.add('frt-avatar-cutout');
      img.src = croppedUrl;
    } catch (error) {
      console.error('프로필 사진 투명 영역 확인 실패:', error);
    }
  }, { once: true });

  pin.append(img);
  img.src = src;
}

  async function loadAvatar(node, owner) {
  const request = {};
  avatarRequests.set(node, request);
  paintAvatar(node, null);

  if (!owner) return;

  try {
    const files = checked(
      await avatarBucket.list(owner, {
        search: 'avatar.',
        limit: 10
      })
    ) || [];

    // 새 PNG 사진 우선, 없으면 기존 JPG 사진 사용
    const filename = files.some(file => file.name === 'avatar.png')
      ? 'avatar.png'
      : files.some(file => file.name === 'avatar.jpg')
        ? 'avatar.jpg'
        : null;

    if (!filename) return;

    const data = checked(
      await avatarBucket.createSignedUrl(
        owner + '/' + filename,
        3600
      )
    );

    if (
      avatarRequests.get(node) !== request ||
      !node.isConnected
    ) return;

    const url = new URL(data.signedUrl);
    url.searchParams.set('v', crypto.randomUUID());

    paintAvatar(node, url.href);
  } catch (error) {
    console.error('프로필 사진 조회 실패:', error);
  }
}

  async function prepareAvatar(file) {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('20MB 이하의 사진을 선택해 주세요.');
  }

  const url = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;

      img.onerror = () => reject(
        new Error(
          '사진을 읽지 못했어요. JPG 또는 PNG 사진을 선택해 주세요.'
        )
      );

      img.src = url;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;

    if (!width || !height) {
      throw new Error('사진 크기를 확인하지 못했어요.');
    }

    // 원본 비율 유지. 작은 이미지는 강제로 확대하지 않는다.
    const scale = Math.min(1, 1024 / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('사진을 처리하지 못했어요.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 정사각형으로 자르지 않고 전체 이미지를 저장한다.
    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('사진을 변환하지 못했어요.'));
        }
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

  function mountProfileAvatar() {
    const screen =
      document.getElementById('profileFeedScreen');

    const original = screen?.querySelector(
      '.frt-profile-card .hero-avatar'
    );

    if (!original) return;

    const avatar = button('', () => {
      if (!avatar.disabled) input.click();
    });

    avatar.className = 'hero-avatar frt-avatar-edit';
    avatar.setAttribute(
      'aria-label',
      '프로필 사진 선택 또는 변경'
    );
    avatar.title = '눌러서 프로필 사진 변경';
    avatar.disabled = true;

    original.replaceWith(avatar);
    paintAvatar(avatar, null);

    const input = el('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    document.body.append(input);

    const status = el('p', '', 'frt-avatar-status');
    status.setAttribute('role', 'status');

    screen.querySelector('.frt-profile-card').after(status);

    let owner = null;
    let version = 0;
    let uploading = false;

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';

      if (!file || !owner || uploading) return;

      const selectedOwner = owner;
      const selectedVersion = version;

      const isCurrent = () =>
        owner === selectedOwner &&
        version === selectedVersion;

      uploading = true;
      avatar.disabled = true;
      status.textContent = '프로필 사진을 저장하고 있어요.';

      try {
        const blob = await prepareAvatar(file);
        const active = await user();

        if (
          !isCurrent() ||
          active.id !== selectedOwner
        ) return;

        checked(
          await avatarBucket.upload(
             selectedOwner + '/avatar.png',
             blob,
             {
               contentType: 'image/png',
               cacheControl: '0',
               upsert: true
             }
           )
        );

        const confirmed = await user();

        if (
          !isCurrent() ||
          confirmed.id !== selectedOwner
        ) return;

        // 이전 사진 조회가 늦게 끝나도 새 사진을 덮지 않는다.
        avatarRequests.set(avatar, {});

        const preview = URL.createObjectURL(blob);
        paintAvatar(avatar, preview);

        const img = avatar.querySelector('img');
        const release = () => URL.revokeObjectURL(preview);

        img.addEventListener('load', release, { once: true });
        img.addEventListener('error', release, { once: true });

        status.textContent = '프로필 사진을 저장했어요.';
      } catch (error) {
        if (isCurrent()) {
          console.error('프로필 사진 저장 실패:', error);

          status.textContent =
            error.message || '사진을 저장하지 못했어요.';
        }
      } finally {
        uploading = false;
        avatar.disabled = !owner;
      }
    });

    client.auth.onAuthStateChange((event, session) => {
      const next = session?.user?.id || null;

      if (next === owner) return;

      owner = next;
      version++;

      avatarRequests.set(avatar, {});
      paintAvatar(avatar, null);
      status.textContent = '';
      avatar.disabled = !owner || uploading;

      const currentVersion = version;

      // 인증 콜백 바깥에서 사진을 조회한다.
      setTimeout(() => {
        if (currentVersion === version) {
          void loadAvatar(avatar, owner);
        }
      }, 0);
    });

    new MutationObserver(() => {
      if (
        !screen.classList.contains('hidden') &&
        !screen.classList.contains('frt-viewing-public-profile') &&
        !uploading
      ) {
        void loadAvatar(avatar, owner);
      }
    }).observe(screen, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
    let publicProfileRevision = 0;

  function clearPublicProfile() {
    publicProfileRevision++;

    const screen =
      document.getElementById('profileFeedScreen');

    screen?.classList.remove('frt-viewing-public-profile');
    document.getElementById('frtPublicProfile')?.remove();
  }

  async function openAccountProfile(account) {
    const screen =
      document.getElementById('profileFeedScreen');

    if (
      !screen ||
      !account?.user_id ||
      typeof window.openAppPage !== 'function'
    ) return;

    clearPublicProfile();

    if (!window.frtOpenProfileFromSearch?.()) return;

    if (screen.classList.contains('hidden')) return;

    const request = ++publicProfileRevision;
    const panel = el('section');
    panel.id = 'frtPublicProfile';

    const back = button('← 검색으로 돌아가기', () => {
      clearPublicProfile();
      window.openAppPage('home');
      window.frtRestoreAccountSearch?.();
    });

        const header = el('div', undefined, 'profile-feed-header');
    header.append(back, el('h2', 'Record Profile Feed'));

    const hero = el(
      'div',
      undefined,
      'hero-card frt-profile-card'
    );

    hero.innerHTML = `
      <div class="hero-overlay">
        <div class="frt-profile-top">
          <div class="hero-avatar">F</div>

          <div class="frt-profile-summary">
            <h2 class="hero-name" tabindex="-1"></h2>

            <div class="frt-profile-stats">
              <div class="frt-profile-stat">
                <strong data-stat="trips">—</strong>
                <span>런트립 횟수</span>
              </div>

              <div class="frt-profile-stat">
                <strong data-stat="distance">—</strong>
                <span>러닝 km</span>
              </div>

              <div class="frt-profile-stat">
                <strong data-stat="followers">—</strong>
                <span>팔로워</span>
              </div>
            </div>
          </div>
        </div>

        <div class="hero-badge">🌙 Night Runner</div>
        <p class="hero-pace">"오늘도 잘 버틴 Pace"</p>
      </div>
    `;

    const heading = hero.querySelector('.hero-name');
    heading.textContent = account.username;

    const status = el('p', '프로필을 불러오고 있어요.');
    status.setAttribute('role', 'status');

    const list = el('div', undefined, 'frt-profile-post-grid');
    const recent = el('div', undefined, 'recent-feed');

    recent.append(el('h3', 'Recent Runs'), list);

    const ad = el(
      'aside',
      undefined,
      'frt-ad-slot frt-ad-slot--banner'
    );

    ad.setAttribute('aria-label', '광고 공간 미리보기');

    ad.append(
      el('span', '광고 · 미리보기', 'frt-ad-slot-label'),
      el('div', '배너 광고 공간', 'frt-ad-slot-body')
    );

    panel.append(header, hero, status, recent, ad);

    screen.append(panel);
    
    void loadAvatar(
      hero.querySelector('.hero-avatar'),
      account.user_id
    );

    screen.classList.add('frt-viewing-public-profile');

    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });

    const isCurrent = () =>
      request === publicProfileRevision &&
      panel.isConnected &&
      !screen.classList.contains('hidden');

    try {
      const current = await user();
      if (!isCurrent()) return;

            try {
        const profiles = checked(
          await client.rpc('frt_social_public_profile', {
            target_user_id: account.user_id
          })
        );

        if (!isCurrent()) return;

        const profile = profiles?.[0];

        if (!profile) {
          throw new Error('계정 정보를 찾을 수 없어요.');
        }

        heading.textContent = profile.username;

        hero.querySelector('[data-stat="trips"]').textContent =
          String(profile.runtrip_count ?? 0);

        hero.querySelector('[data-stat="distance"]').textContent =
          Number(profile.total_distance_km ?? 0).toFixed(1) + 'km';

        hero.querySelector('[data-stat="followers"]').textContent =
          String(profile.follower_count ?? 0);
      } catch (error) {
        if (!isCurrent()) return;

        console.error('공개 프로필 통계 조회 실패:', error);
        status.textContent = '프로필 통계를 불러오지 못했어요.';
      }

      const profileNotice =
        status.textContent === '프로필 통계를 불러오지 못했어요.'
          ? status.textContent
          : '';
      const rows = checked(
        await client
          .from('frt_social_posts')
          .select('id,user_id,image_path,caption,created_at')
          .eq('user_id', account.user_id)
          .order('created_at', { ascending: false })
          .order('id')
          .limit(30)
      ) || [];

      if (!isCurrent()) return;

      const cards = await Promise.all(
        rows.map(async post => {
          const article = el(
            'article',
            undefined,
            'feed-card recent-run-card'
          );

          try {
            const data = checked(
              await bucket.createSignedUrl(
                post.image_path,
                3600
              )
            );

            if (!data?.signedUrl) {
              throw new Error('이미지 주소 없음');
            }

            const img = el('img');

            img.dataset.frtSocialPostId = String(post.id);
            img.dataset.frtSocialOwner = String(post.user_id);

            img.className = 'recent-run-photo';
            img.alt =
              account.username + '의 기록 게시물';
            img.loading = 'lazy';

            img.addEventListener('error', () => {
              img.replaceWith(
                el('p', '이미지를 불러오지 못했어요.')
              );
            }, { once: true });

            img.src = data.signedUrl;
            article.append(img);
            
          } catch (error) {
            console.error('프로필 이미지 조회 실패:', error);
            article.append(
              el('p', '이미지를 불러오지 못했어요.')
            );
          }

          if (post.caption) {
            article.append(
              el('p', post.caption, 'frt-published-caption')
            );
          }

          article.append(
            el(
              'small',
              new Date(post.created_at).toLocaleDateString(
                document.documentElement.lang || 'ko'
              )
            )
          );

          return article;
        })
      );

      const confirmed = await user();
      if (!isCurrent()) return;

      if (confirmed.id !== current.id) {
        clearPublicProfile();
        return;
      }

      list.replaceChildren(...cards);

      status.textContent = !rows.length
        ? '아직 공개한 게시물이 없어요.'
        : rows.length === 30
          ? '최근 공개 게시물 30개를 표시해요.'
          : '';
      status.textContent = [profileNotice, status.textContent]
        .filter(Boolean)
        .join(' ');    
    } catch (error) {
      if (!isCurrent()) return;

      console.error('계정 프로필 조회 실패:', error);

      status.textContent =
        error.message === '로그인이 필요해요.'
          ? error.message
          : '게시물을 불러오지 못했어요. 다시 시도해 주세요.';
    }
  }

  function mountPublicProfile() {
    const screen =
      document.getElementById('profileFeedScreen');

    if (!screen) return;

    new MutationObserver(() => {
      if (
        screen.classList.contains('hidden') &&
        document.getElementById('frtPublicProfile')
      ) {
        clearPublicProfile();
      }
    }).observe(screen, {
      attributes: true,
      attributeFilter: ['class']
    });

    document.querySelectorAll('.app-nav-button').forEach(nav => {
      nav.addEventListener('click', () => {
        if (nav.dataset.pageTarget) {
          clearPublicProfile();
        }
      }, true);
    });

    let accountId;

    client.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id || null;

      if (nextId !== accountId || event === 'SIGNED_OUT') {
        accountId = nextId;
        clearPublicProfile();
      }
    });
  }
    function mountAccountSearch() {
    const trigger =
      document.getElementById('homeAccountSearchBtn');

    if (!trigger) return;

    const dialog = el('section');
    dialog.id = 'frtAccountSearchDialog';
    dialog.hidden = true;
    dialog.setAttribute(
      'aria-labelledby',
      'frtAccountSearchTitle'
    );

    const header = el(
      'div',
      undefined,
      'frt-account-search-header'
    );

    const title = el('h2', '계정 검색');
    title.id = 'frtAccountSearchTitle';

    title.tabIndex = -1;
    header.append(title);

    const form = el('form');
    form.className = 'frt-account-search-form';

    const input = el('input');
    input.type = 'search';
    input.placeholder = '아이디 검색';
    input.maxLength = 21;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('aria-label', '검색할 계정 아이디');
    input.setAttribute('enterkeyhint', 'search');

    const submit = el('button', '검색');
    submit.type = 'submit';

    form.append(input, submit);

    const status = el('p', '찾고 싶은 아이디를 입력해 주세요.');
    status.setAttribute('role', 'status');

    const list = el('ul');
    list.setAttribute('aria-label', '계정 검색 결과');

    dialog.append(header, form, status, list);
    document.body.append(dialog);

    let revision = 0;
    let timer;
    let composing = false;
    let savedScrollTop = 0;

    function hideSearchPage(reset = false) {
      savedScrollTop = dialog.scrollTop;
      input.blur();
      dialog.hidden = true;
      document.body.classList.remove('frt-search-page-open');

      // 진행 중인 검색 응답이 화면을 다시 변경하지 않도록 한다.
      clearTimeout(timer);
      revision++;

      if (reset) {
        list.replaceChildren();
        input.value = '';
        composing = false;
        savedScrollTop = 0;
        status.textContent = '찾고 싶은 아이디를 입력해 주세요.';
      }
    }

    function showSearchPage(restore = false) {
      if (!restore) {
        invalidate();
        input.value = '';
        composing = false;
        savedScrollTop = 0;
        status.textContent = '찾고 싶은 아이디를 입력해 주세요.';
      }

      dialog.hidden = false;
      document.body.classList.add('frt-search-page-open');
      dialog.scrollTop = savedScrollTop;

      window.frtArmDetailBack?.();

      if (restore) {
        title.focus({ preventScroll: true });
      } else {
        input.focus({ preventScroll: true });
      }
    }

    window.frtRestoreAccountSearch = function () {
      showSearchPage(true);
    };

    window.frtCloseAccountSearch = function () {
      if (dialog.hidden) return false;

      hideSearchPage(true);
      trigger.focus({ preventScroll: true });
      return true;
    };

    function invalidate() {
      clearTimeout(timer);
      revision++;
      list.replaceChildren();
    }

    async function search() {
      invalidate();

      const request = revision;
      const query = input.value
        .trim()
        .replace(/^@/, '')
        .toLowerCase();

      if (!query) {
        status.textContent =
          '찾고 싶은 아이디를 입력해 주세요.';
        return;
      }

      if (!/^[a-z0-9_]{1,20}$/.test(query)) {
        status.textContent =
          '영문·숫자·밑줄(_)로 아이디를 검색해 주세요.';
        return;
      }

      status.textContent = '계정을 검색하고 있어요.';

      try {
        await user();

        if (request !== revision || dialog.hidden) return;

        const rows = checked(
          await client.rpc('frt_social_search_accounts', {
            search_text: query
          })
        ) || [];

        if (request !== revision || dialog.hidden) return;

        for (const row of rows) {
          const item = el('li');

          const accountButton = button(
            row.username,
            () => {
              hideSearchPage();
              void openAccountProfile(row);
            }
          );

          accountButton.className = 'frt-account-result';
          accountButton.setAttribute(
            'aria-label',
            row.username + '의 기록 프로필 피드 보기'
          );

          const avatar = el(
            'span',
            undefined,
            'frt-account-result-avatar'
          );

          avatar.setAttribute('aria-hidden', 'true');
          paintAvatar(avatar, null);

          const name = el(
            'span',
            row.username,
            'frt-account-result-name'
          );

          accountButton.replaceChildren(avatar, name);

          item.append(accountButton);
          list.append(item);

          void loadAvatar(avatar, row.user_id);
        }

        status.textContent = rows.length
          ? rows.length === 30
            ? '검색 결과 30개예요. 아이디를 더 입력하면 결과를 좁힐 수 있어요.'
            : `검색 결과 ${rows.length}개예요.`
          : '일치하는 계정이 없어요.';
      } catch (error) {
        if (request !== revision || dialog.hidden) return;

        console.error('계정 검색 실패:', error);
        status.textContent =
          error.message === '로그인이 필요해요.'
            ? error.message
            : '검색하지 못했어요. 잠시 후 다시 시도해 주세요.';
      }
    }

    function scheduleSearch() {
      invalidate();

      if (composing) return;

      status.textContent = input.value.trim()
        ? '검색을 준비하고 있어요.'
        : '찾고 싶은 아이디를 입력해 주세요.';

      timer = setTimeout(search, 300);
    }

    input.addEventListener('input', scheduleSearch);

    input.addEventListener('compositionstart', () => {
      composing = true;
      invalidate();
    });

    input.addEventListener('compositionend', () => {
      composing = false;
      scheduleSearch();
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!composing) void search();
    });

      trigger.addEventListener('click', () => {
      showSearchPage();
    });

    client.auth.onAuthStateChange((event, session) => {
      if (
        event === 'SIGNED_OUT' ||
        event === 'SIGNED_IN' ||
        !session
      ) {
        hideSearchPage(true);
      }
    });
  }
    // 프로필 사진을 기존 공유 게시물에 연결
  async function getProfilePostLinks(grid, current) {
    const images = Array.from(
      grid.querySelectorAll(
        '.recent-run-card > .recent-run-photo'
      )
    );

    const links = new Map();

    // 다른 계정 프로필: 서버 게시물 ID를 그대로 사용
    if (grid.id !== 'profileRecentRuns') {
      for (const image of images) {
        if (
          image.dataset.frtSocialPostId &&
          image.dataset.frtSocialOwner
        ) {
          links.set(image, {
            id: image.dataset.frtSocialPostId,
            user_id: image.dataset.frtSocialOwner
          });
        }
      }

      return links;
    }

    // 내 프로필: 원본 기록 ID로 기존 공유 게시물 조회
    const sourceIds = [
      ...new Set(
        images
          .map(image => image.dataset.frtSourceRecord)
          .filter(Boolean)
          .map(value => decodeURIComponent(value))
      )
    ];

    // 한 번에 너무 많은 ID를 보내지 않도록 나누어 조회
    for (let start = 0; start < sourceIds.length; start += 50) {
      const rows = checked(
        await client
          .from('frt_social_posts')
          .select('id,user_id,source_record_id')
          .eq('user_id', current.id)
          .in(
            'source_record_id',
            sourceIds.slice(start, start + 50)
          )
      ) || [];

      const postsByRecord = new Map(
        rows.map(post => [
          String(post.source_record_id),
          post
        ])
      );

      for (const image of images) {
        const encoded =
          image.dataset.frtSourceRecord;

        if (!encoded) continue;

        const post = postsByRecord.get(
          decodeURIComponent(encoded)
        );

        if (post) links.set(image, post);
      }
    }

    return links;
  }
    const profileReactionLoads = new WeakMap();

  async function mountProfileReactions(grid) {
    const run =
      (profileReactionLoads.get(grid) || 0) + 1;

    profileReactionLoads.set(grid, run);

    const epoch = reactionAccountEpoch;

    const valid = () =>
      grid.isConnected &&
      grid.classList.contains('frt-profile-expanded') &&
      profileReactionLoads.get(grid) === run &&
      reactionAccountEpoch === epoch;

    for (const view of postReactionViews) {
      if (!view.valid()) {
        postReactionViews.delete(view);
      }
    }

    const hosts = new Map();

    grid.querySelectorAll(
      ':scope > .recent-run-card'
    ).forEach(card => {
      card.querySelectorAll(
        ':scope > .frt-profile-reactions'
      ).forEach(node => node.remove());

      const image = card.querySelector(
        ':scope > .recent-run-photo'
      );

      if (!image) return;

      const host = el(
        'div',
        undefined,
        'frt-profile-reactions'
      );

      host.append(
        el('p', '좋아요·댓글을 불러오고 있어요.')
      );

      card.append(host);
      hosts.set(image, host);
    });

    try {
      const current = await user();

      if (!valid()) return;

      const links = await getProfilePostLinks(
        grid,
        current
      );

      if (!valid()) return;

      const confirmed = await user();

      if (
        !valid() ||
        confirmed.id !== current.id
      ) {
        return;
      }

      await Promise.all(
        Array.from(hosts, async ([image, host]) => {
          const currentView = () =>
            valid() &&
            host.isConnected &&
            image.parentElement === host.parentElement;

          if (!currentView()) return;

          host.replaceChildren();

          const post = links.get(image);

          if (!post) {
            host.append(
              el(
                'p',
                '연결된 공유 게시물이 없어 좋아요·댓글을 표시할 수 없어요.'
              )
            );
            return;
          }

          await appendPostReactions(
            post,
            current,
            currentView,
            host
          );
        })
      );
    } catch (error) {
      if (!valid()) return;

      console.error('프로필 반응 조회 실패:', error);

      for (const host of hosts.values()) {
        if (!host.isConnected) continue;

        host.replaceChildren(
          el('p', '좋아요·댓글을 불러오지 못했어요.')
        );

        host.append(
          button('다시 시도', () => {
            void mountProfileReactions(grid);
          })
        );
      }
    }
  }
    function mountInlineProfileFeed() {
    const screen =
      document.getElementById('profileFeedScreen');

    if (!screen || screen.dataset.inlinePostsReady) return;

    screen.dataset.inlinePostsReady = 'true';

    let active = null;

    const selector =
      '#profileRecentRuns, #frtPublicProfile .frt-profile-post-grid';

    // 사진 격자로 돌아오기
    function collapse(restore = true) {
      if (!active) return;

      const saved = active;
      active = null;

      saved.grid.classList.remove('frt-profile-expanded');
      saved.bar.remove();

      if (restore) {
        requestAnimationFrame(() => {
          if (!saved.grid.isConnected) return;

          for (const item of saved.positions) {
            item.node.scrollTop = item.top;
            item.node.scrollLeft = item.left;
          }

          window.scrollTo(saved.x, saved.y);

          if (saved.card.isConnected) {
            saved.card.focus({ preventScroll: true });
          }
        });
      }
    }

    // 기존 격자를 세로 목록으로 전환
    function open(card, grid) {
      if (active?.grid === grid) return;

      collapse(false);

      const positions = [];

      for (
        let node = grid.parentElement;
        node;
        node = node.parentElement
      ) {
        positions.push({
          node,
          top: node.scrollTop,
          left: node.scrollLeft
        });
      }

      const bar = el(
        'div',
        undefined,
        'frt-profile-list-bar'
      );

      bar.append(
        button('← 사진 격자로', () => collapse())
      );

      active = {
        grid,
        card,
        bar,
        positions,
        x: window.scrollX,
        y: window.scrollY
      };

      grid.before(bar);
      grid.classList.add('frt-profile-expanded');
      
      void mountProfileReactions(grid);

      requestAnimationFrame(() => {
        if (
          active?.card === card &&
          card.isConnected
        ) {
          card.scrollIntoView({
            block: 'start',
            behavior: 'auto'
          });
        }
      });
    }

    function activate(event) {
      if (
        event.type === 'keydown' &&
        !['Enter', ' '].includes(event.key)
      ) {
        return;
      }

      if (
        event.target.closest(
          'button, a, input, textarea'
        )
      ) {
        return;
      }

      const card =
        event.target.closest('.recent-run-card');

      const grid = card?.parentElement;

      if (
        !grid?.matches(selector) ||
        !card.querySelector('img')
      ) {
        return;
      }

      if (
        grid.classList.contains('frt-profile-expanded')
      ) {
        return;
      }

      event.preventDefault();
      open(card, grid);
    }

    function prepare() {
      if (
        active &&
        (
          !active.card.isConnected ||
          screen.classList.contains('hidden') ||
          (
            active.grid.id === 'profileRecentRuns' &&
            screen.classList.contains(
              'frt-viewing-public-profile'
            )
          )
        )
      ) {
        collapse(false);
      }

      screen.querySelectorAll(selector).forEach(grid => {
        grid.querySelectorAll(
          ':scope > .recent-run-card'
        ).forEach(card => {
          if (!card.querySelector('img')) return;

          card.tabIndex = 0;

          if (
            grid.classList.contains('frt-profile-expanded')
          ) {
            card.removeAttribute('role');
            card.removeAttribute('aria-label');
          } else {
            card.setAttribute('role', 'button');
            card.setAttribute(
              'aria-label',
              '게시물을 세로 목록으로 보기'
            );
          }
        });
      });
    }

    screen.addEventListener('click', activate);
    screen.addEventListener('keydown', activate);

    new MutationObserver(prepare).observe(screen, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    prepare();
  }
  function mount() {
    mountInlineProfileFeed();
    mountProfileFollows();
    mountProfileAvatar();
    mountPublicProfile();
    mountAccountSearch();

    const anchor = document.getElementById('frtHomeFeedRoot');
    if (!anchor) return;
    const style = el('style');
    style.textContent = `.frt-social{margin-top:24px}.frt-social nav,.frt-social-actions{display:flex;gap:10px;margin:12px 0;flex-wrap:wrap}.frt-social button{padding:10px 14px;border:1px solid #d1d5db;border-radius:12px;background:#fff;color:#111;cursor:pointer}.frt-social button[aria-pressed=true]{color:#d62954;border-color:#d62954}.frt-social button:disabled{opacity:.5}.frt-social-card{padding:16px;margin:16px 0;border:1px solid #ddd;border-radius:16px;background:#fff;color:#111;overflow:hidden}.frt-social-card small{display:block;margin:6px 0 12px;color:#666}.frt-social-card img{display:block;width:100%;height:auto;border-radius:10px}.frt-social-card p{white-space:pre-wrap;overflow-wrap:anywhere}.frt-social-card textarea{box-sizing:border-box;width:100%;min-height:70px;font:inherit;padding:10px;border:1px solid #ccc;border-radius:10px}.frt-social-status{font-size:13px;color:#9b2534}`;
    document.head.append(style);
        root = el('section', undefined, 'frt-social');
    root.setAttribute('aria-label', '홈 게시물 피드');

    const nav = el('nav');
    nav.setAttribute('aria-label', '게시물 보기');

    const recommended = button('추천', () => {
      scope = 'recommended';
      update();
    });

    const following = button('팔로잉', () => {
      scope = 'following';
      update();
    });

    function update() {
      recommended.setAttribute(
        'aria-pressed',
        String(scope === 'recommended')
      );

      following.setAttribute(
        'aria-pressed',
        String(scope === 'following')
      );

      refresh();
    }

    nav.append(
      recommended,
      following
    );

    root.append(
      nav,
      el('div', undefined, 'frt-social-list')
    );

    anchor.replaceChildren(root);
    update();
    // Defer Supabase queries outside its auth callback.
        let feedAccountId;

    client.auth.onAuthStateChange((event, session) => {
      const nextAccountId = session?.user?.id || null;

      if (nextAccountId !== feedAccountId) {
        ++reactionAccountEpoch;
        postReactionViews.clear();

        feedAccountId = nextAccountId;
        shownCounts.clear();
      }

      ++generation;

      root.querySelector(
        '.frt-social-list'
      ).replaceChildren();

      // 인증 콜백이 끝난 뒤 게시물을 조회한다.
      setTimeout(refresh, 0);
    });
    const screen = document.getElementById('homeScreen');
    if (screen) new MutationObserver(() => {
      if (!screen.classList.contains('hidden') && !busy) {
        busy = true; refresh().finally(() => { busy = false; });
      }
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
