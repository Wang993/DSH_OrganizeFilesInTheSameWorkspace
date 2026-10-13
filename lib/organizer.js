// dsh-session-organizer 客户端脚本：左下角 🗂 按钮 + 会话整理面板。
// 纯 DOM 实现，无任何依赖；由宿主插件经 <script defer> 注入。
(function () {
  if (window.__dshOrganizer) return
  window.__dshOrganizer = true

  var STATE_URL = '/dsh-organizer/state.json'
  var ARCHIVE_URL = '/dsh-organizer/archive'
  var TAGS_URL = '/dsh-organizer/tags'
  var ROW_CAP = 300

  var css = [
    '.dsgo-btn{position:fixed;left:16px;bottom:24px;z-index:9997;width:42px;height:42px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));background:var(--dsw-alias-button-floating-fill,rgba(255,255,255,.92));color:var(--dsw-alias-label-primary,#333);font-size:19px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;padding:0;transition:left .18s ease,bottom .18s ease,transform .15s ease,background .15s ease}',
    '.dsgo-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));transform:scale(1.06)}',
    '.dsgo-btn.dsgo-active{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.08))}',
    '.dsgo-panel{position:fixed;left:16px;bottom:80px;z-index:9997;width:340px;max-width:calc(100vw - 32px);max-height:min(72vh,680px);display:none;flex-direction:column;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.14));border-radius:14px;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base,#fff));box-shadow:0 10px 34px rgba(0,0,0,.28);overflow:hidden;font-family:inherit}',
    '.dsgo-panel.dsgo-open{display:flex}',
    '.dsgo-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));flex:none}',
    '.dsgo-title{flex:1;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#222)}',
    '.dsgo-close{border:none;background:none;color:var(--dsw-alias-label-secondary,#555);cursor:pointer;font-size:16px;line-height:1;padding:4px 8px;border-radius:6px}',
    '.dsgo-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
    '.dsgo-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));flex:none;max-height:96px;overflow:auto}',
    '.dsgo-chip{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.16));background:transparent;color:var(--dsw-alias-label-secondary,#444);border-radius:999px;padding:2px 10px;font-size:12px;cursor:pointer;line-height:18px}',
    '.dsgo-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}',
    '.dsgo-chip.dsgo-on{border-color:#3b5bdb;background:#3b5bdb;color:#fff}',
    '.dsgo-body{flex:1;overflow:auto;padding:6px 12px 12px;min-height:0}',
    '.dsgo-group{margin-top:10px}',
    '.dsgo-group-head{font-size:12px;font-weight:600;color:var(--dsw-alias-label-tertiary,#777);padding:2px 4px;margin-bottom:2px;display:flex;align-items:center;gap:6px}',
    '.dsgo-count{font-weight:400;opacity:.8}',
    '.dsgo-row{border-radius:10px;padding:6px 8px;margin:2px 0;transition:background .12s ease}',
    '.dsgo-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.045))}',
    '.dsgo-row-main{display:flex;align-items:center;gap:6px;min-width:0}',
    '.dsgo-row-title{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary,#222);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.dsgo-row-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;min-width:0}',
    '.dsgo-row-sub .dsgo-tagchip{flex:none}',
    '.dsgo-act{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.16));background:transparent;color:var(--dsw-alias-label-secondary,#444);border-radius:7px;font-size:11px;padding:2px 8px;cursor:pointer;flex:none;white-space:nowrap;line-height:16px}',
    '.dsgo-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}',
    '.dsgo-act.dsgo-danger:hover{color:#c0392b;border-color:#c0392b}',
    '.dsgo-act.dsgo-primary{color:#3b5bdb;border-color:rgba(59,91,219,.45)}',
    '.dsgo-tagchip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:rgba(59,91,219,.1);color:#3b5bdb;font-size:11px;padding:1px 8px;cursor:pointer;line-height:16px}',
    '.dsgo-tagchip:hover{background:rgba(59,91,219,.18)}',
    '.dsgo-editor{border-top:1px dashed var(--dsw-alias-border-l1,rgba(0,0,0,.14));margin-top:6px;padding-top:6px;display:flex;flex-direction:column;gap:6px}',
    '.dsgo-editor-tags{display:flex;flex-wrap:wrap;gap:4px}',
    '.dsgo-x{font-weight:700;opacity:.7;margin-left:2px}',
    '.dsgo-x:hover{opacity:1}',
    '.dsgo-editor-row{display:flex;gap:6px}',
    '.dsgo-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.16));border-radius:7px;padding:3px 8px;font-size:12px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);outline:none}',
    '.dsgo-input:focus{border-color:#3b5bdb}',
    '.dsgo-quick{display:flex;flex-wrap:wrap;gap:4px}',
    '.dsgo-quick button{font-size:11px;border:1px dashed var(--dsw-alias-border-l1,rgba(0,0,0,.2));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#555);padding:1px 8px;cursor:pointer;line-height:16px}',
    '.dsgo-quick button:hover{border-color:#3b5bdb;color:#3b5bdb}',
    '.dsgo-empty{color:var(--dsw-alias-label-tertiary,#999);font-size:12px;text-align:center;padding:18px 0}',
    '.dsgo-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));font-size:11px;color:var(--dsw-alias-label-tertiary,#888);flex:none}',
    '.dsgo-error{color:#c0392b;font-size:12px;padding:8px 12px}',
    '.dsgo-muted{color:var(--dsw-alias-label-tertiary,#999)}'
  ].join('\n')

  var styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  var app = {
    data: null,
    filter: 'all', // 'all' | 'untagged' | 'archived' | <tag>
    open: false,
    expanded: null, // session id whose tag editor is open
    busy: false,
    error: null,
    lastUpdated: null
  }
  var pollTimer = null

  function h(tag, cls, children) {
    var el = document.createElement(tag)
    if (cls) el.className = cls
    if (children === undefined || children === null) return el
    if (typeof children === 'string') {
      el.textContent = children
      return el
    }
    for (var i = 0; i < children.length; i++) {
      var child = children[i]
      if (child === null || child === undefined) continue
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
    }
    return el
  }

  var SVG_NS = 'http://www.w3.org/2000/svg'
  // 菱形图标：内联 SVG，跟随主题文字色（currentColor），明暗主题都自适应。
  function diamondIcon(size) {
    var svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
    svg.setAttribute('aria-hidden', 'true')
    svg.style.display = 'block'
    var outer = document.createElementNS(SVG_NS, 'path')
    outer.setAttribute('d', 'M12 2.2 21.8 12 12 21.8 2.2 12Z')
    outer.setAttribute('fill', 'none')
    outer.setAttribute('stroke', 'currentColor')
    outer.setAttribute('stroke-width', '2')
    outer.setAttribute('stroke-linejoin', 'round')
    var inner = document.createElementNS(SVG_NS, 'path')
    inner.setAttribute('d', 'M12 8.4 15.6 12 12 15.6 8.4 12Z')
    inner.setAttribute('fill', 'currentColor')
    svg.appendChild(outer)
    svg.appendChild(inner)
    return svg
  }

  var btn = h('button', 'dsgo-btn')
  btn.appendChild(diamondIcon(18))
  btn.title = '会话整理：标签分类 / 归档 / 恢复'
  document.body.appendChild(btn)

  var panel = h('div', 'dsgo-panel')
  document.body.appendChild(panel)

  // 把按钮吸附到侧边栏底部「设置」区旁边：实时读取设置区的屏幕位置，
  // 侧边栏伸缩 / 窗口变化 / React 重渲染时自动跟随；找不到设置区则回退到左下角。
  var dockRaf = null
  function dockButton() {
    if (dockRaf) return
    dockRaf = requestAnimationFrame(function () {
      dockRaf = null
      var docked = false
      try {
        var anchor = document.querySelector('.hHd-Xa_settingsArea')
        if (anchor) {
          var r = anchor.getBoundingClientRect()
          var w = window.innerWidth
          var h = window.innerHeight
          var btnSize = btn.offsetHeight || 42
          if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.bottom <= h + 120) {
            var left = r.right + 10
            if (left + btnSize <= w) {
              var bottomPx = Math.max(10, h - r.bottom + r.height / 2 - btnSize / 2)
              btn.style.left = left + 'px'
              btn.style.bottom = bottomPx + 'px'
              btn.classList.add('dsgo-docked')
              panel.style.left = Math.max(12, Math.min(left, w - (panel.offsetWidth || 340) - 12)) + 'px'
              panel.style.bottom = (bottomPx + btnSize + 10) + 'px'
              docked = true
            }
          }
        }
      } catch (err) {}
      if (!docked) {
        btn.style.left = '16px'
        btn.style.bottom = '24px'
        btn.classList.remove('dsgo-docked')
        panel.style.left = '16px'
        panel.style.bottom = '80px'
      }
    })
  }
  window.addEventListener('resize', dockButton)
  if (window.MutationObserver) {
    var dockObserver = new MutationObserver(dockButton)
    dockObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  }
  setInterval(dockButton, 1500)
  dockButton()

  function pad(n) { return (n < 10 ? '0' : '') + n }

  function timeLabel(ts) {
    if (!ts) return ''
    var d = new Date(ts)
    var now = new Date()
    if (d.toDateString() === now.toDateString()) return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    var yesterday = new Date(now.getTime() - 86400000)
    if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  function post(url, payload) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error((data && data.error) || '操作失败')
        return data
      })
  }

  async function refresh() {
    if (app.busy) return
    app.busy = true
    try {
      var r = await fetch(STATE_URL, { cache: 'no-store' })
      var data = await r.json()
      if (!data || data.ok !== true) throw new Error((data && data.error) || '无法读取会话列表')
      app.data = data
      app.error = null
      app.lastUpdated = new Date()
    } catch (err) {
      app.error = String((err && err.message) || err)
    } finally {
      app.busy = false
      render()
    }
  }

  function reportActionError(err) {
    app.error = String((err && err.message) || err)
    render()
  }

  function sessionMatches(s) {
    if (app.filter === 'all') return true
    if (app.filter === 'untagged') return !s.archived && s.tags.length === 0
    if (app.filter === 'archived') return s.archived
    return !s.archived && s.tags.indexOf(app.filter) !== -1
  }

  function chip(label, value, count) {
    var text = label + (typeof count === 'number' ? ' · ' + count : '')
    var c = h('button', 'dsgo-chip' + (app.filter === value ? ' dsgo-on' : ''), text)
    c.addEventListener('click', function () {
      app.filter = value
      app.expanded = null
      render()
    })
    return c
  }

  function tagChip(tag, onClick) {
    var c = h('span', 'dsgo-tagchip', tag)
    if (onClick) c.addEventListener('click', onClick)
    return c
  }

  function rowButtons(s) {
    if (s.archived) {
      var restore = h('button', 'dsgo-act dsgo-primary', '恢复')
      restore.title = '从归档恢复，回到侧边栏列表'
      restore.addEventListener('click', function (e) {
        e.stopPropagation()
        post(ARCHIVE_URL, { sessionId: s.id, archived: false }).then(refresh).catch(reportActionError)
      })
      return [restore]
    }
    var archive = h('button', 'dsgo-act dsgo-danger', '归档')
    archive.title = '归档后从侧边栏列表隐藏'
    archive.addEventListener('click', function (e) {
      e.stopPropagation()
      post(ARCHIVE_URL, { sessionId: s.id, archived: true }).then(refresh).catch(reportActionError)
    })
    var tagBtn = h('button', 'dsgo-act', app.expanded === s.id ? '收起标签' : '标签')
    tagBtn.addEventListener('click', function (e) {
      e.stopPropagation()
      app.expanded = app.expanded === s.id ? null : s.id
      render()
    })
    return [tagBtn, archive]
  }

  function tagEditor(s, allTags) {
    var editor = h('div', 'dsgo-editor')
    var existing = h('div', 'dsgo-editor-tags')
    s.tags.forEach(function (tag) {
      var chipEl = tagChip(tag)
      var x = h('span', 'dsgo-x', '×')
      x.title = '移除标签 ' + tag
      x.addEventListener('click', function (e) {
        e.stopPropagation()
        var next = s.tags.filter(function (t) { return t !== tag })
        post(TAGS_URL, { sessionId: s.id, tags: next }).then(refresh).catch(reportActionError)
      })
      chipEl.appendChild(x)
      existing.appendChild(chipEl)
    })
    editor.appendChild(existing)

    var row = h('div', 'dsgo-editor-row')
    var input = h('input', 'dsgo-input')
    input.placeholder = '新标签，回车添加'
    var addBtn = h('button', 'dsgo-act dsgo-primary', '添加')
    function add() {
      var value = input.value.replace(/\s+/g, ' ').trim()
      if (!value) return
      if (s.tags.indexOf(value) !== -1) {
        input.value = ''
        return
      }
      post(TAGS_URL, { sessionId: s.id, tags: s.tags.concat([value]).slice(0, 8) }).then(refresh).catch(reportActionError)
    }
    addBtn.addEventListener('click', add)
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault()
        add()
      }
    })
    row.appendChild(input)
    row.appendChild(addBtn)
    editor.appendChild(row)

    var unused = allTags.filter(function (tag) { return s.tags.indexOf(tag) === -1 }).slice(0, 8)
    if (unused.length) {
      var quick = h('div', 'dsgo-quick')
      unused.forEach(function (tag) {
        var b = h('button', '', '+ ' + tag)
        b.title = '快速添加标签 ' + tag
        b.addEventListener('click', function () {
          post(TAGS_URL, { sessionId: s.id, tags: s.tags.concat([tag]).slice(0, 8) }).then(refresh).catch(reportActionError)
        })
        quick.appendChild(b)
      })
      editor.appendChild(quick)
    }
    return editor
  }

  function sessionRow(s, allTags) {
    var row = h('div', 'dsgo-row')
    var main = h('div', 'dsgo-row-main')
    var title = h('span', 'dsgo-row-title', s.title)
    title.title = s.title
    main.appendChild(title)
    rowButtons(s).forEach(function (b) { main.appendChild(b) })
    row.appendChild(main)

    var sub = h('div', 'dsgo-row-sub')
    var meta = (s.workspaceTitle || '无工作区') + (s.createdAt ? ' · ' + timeLabel(s.createdAt) : '')
    sub.appendChild(h('span', 'dsgo-muted', meta))
    if (s.tags.length && app.expanded !== s.id) {
      s.tags.forEach(function (tag) {
        sub.appendChild(tagChip(tag, function () {
          app.filter = tag
          app.expanded = null
          render()
        }))
      })
    }
    row.appendChild(sub)

    if (app.expanded === s.id) row.appendChild(tagEditor(s, allTags))
    return row
  }

  function render() {
    panel.textContent = ''
    if (!app.data) {
      panel.appendChild(h('div', 'dsgo-empty', app.busy ? '加载中…' : (app.error || '未加载')))
      return
    }
    var data = app.data

    var head = h('div', 'dsgo-head')
    head.appendChild(h('span', 'dsgo-title', '会话整理'))
    var close = h('button', 'dsgo-close', '✕')
    close.title = '关闭'
    close.addEventListener('click', closePanel)
    head.appendChild(close)
    panel.appendChild(head)

    var chips = h('div', 'dsgo-chips')
    var all = data.sessions
    var untagged = all.filter(function (s) { return !s.archived && s.tags.length === 0 }).length
    var archivedN = all.filter(function (s) { return s.archived }).length
    chips.appendChild(chip('全部', 'all', all.length))
    chips.appendChild(chip('未分类', 'untagged', untagged))
    chips.appendChild(chip('已归档', 'archived', archivedN))
    data.allTags.forEach(function (tag) {
      var n = all.filter(function (s) { return !s.archived && s.tags.indexOf(tag) !== -1 }).length
      chips.appendChild(chip(tag, tag, n))
    })
    panel.appendChild(chips)

    if (app.error) panel.appendChild(h('div', 'dsgo-error', '⚠ ' + app.error))

    var body = h('div', 'dsgo-body')
    var visible = all.filter(sessionMatches).slice(0, ROW_CAP)

    if (app.filter !== 'archived') {
      if (app.filter === 'all' || app.filter === 'untagged') {
        var untaggedRows = visible.filter(function (s) { return !s.archived && s.tags.length === 0 })
        var uGroup = h('div', 'dsgo-group')
        uGroup.appendChild(h('div', 'dsgo-group-head', ['📂 未分类', h('span', 'dsgo-count', '（' + untaggedRows.length + '）')]))
        if (!untaggedRows.length) uGroup.appendChild(h('div', 'dsgo-empty', '全部会话都有标签了 🎉'))
        untaggedRows.forEach(function (s) { uGroup.appendChild(sessionRow(s, data.allTags)) })
        body.appendChild(uGroup)
      }
      var tagsToShow = (app.filter === 'all' || app.filter === 'untagged') ? data.allTags : [app.filter]
      tagsToShow.forEach(function (tag) {
        var rows = visible.filter(function (s) { return !s.archived && s.tags.indexOf(tag) !== -1 })
        if (!rows.length) return
        var group = h('div', 'dsgo-group')
        group.appendChild(h('div', 'dsgo-group-head', ['🏷 ' + tag, h('span', 'dsgo-count', '（' + rows.length + '）')]))
        rows.forEach(function (s) { group.appendChild(sessionRow(s, data.allTags)) })
        body.appendChild(group)
      })
    }

    if (app.filter === 'archived' || app.filter === 'all') {
      var archivedRows = visible.filter(function (s) { return s.archived })
      var archGroup = h('div', 'dsgo-group')
      archGroup.appendChild(h('div', 'dsgo-group-head', ['🗄 已归档', h('span', 'dsgo-count', '（' + archivedRows.length + '）')]))
      if (!archivedRows.length) archGroup.appendChild(h('div', 'dsgo-empty', app.filter === 'archived' ? '没有已归档的会话' : '暂无已归档会话，用行内「归档」按钮试试'))
      archivedRows.forEach(function (s) { archGroup.appendChild(sessionRow(s, data.allTags)) })
      body.appendChild(archGroup)
    }

    if (all.length > ROW_CAP) body.appendChild(h('div', 'dsgo-empty', '仅显示前 ' + ROW_CAP + ' 个会话'))
    panel.appendChild(body)

    var foot = h('div', 'dsgo-foot')
    var summary = app.filter === 'all' ? '共 ' + all.length + ' 个会话' : '匹配 ' + visible.length + ' 个'
    foot.appendChild(h('span', '', summary + (app.lastUpdated ? ' · 更新于 ' + timeLabel(app.lastUpdated.getTime()) : '')))
    var refreshBtn = h('button', 'dsgo-act', '刷新')
    refreshBtn.addEventListener('click', function () { refresh() })
    foot.appendChild(refreshBtn)
    panel.appendChild(foot)
  }

  function openPanel() {
    app.open = true
    btn.classList.add('dsgo-active')
    panel.classList.add('dsgo-open')
    refresh()
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(function () {
      if (!app.open) return
      var ae = document.activeElement
      if (ae && ae.closest && ae.closest('.dsgo-input')) return // 输入标签时不打断
      refresh()
    }, 5000)
  }

  function closePanel() {
    app.open = false
    btn.classList.remove('dsgo-active')
    panel.classList.remove('dsgo-open')
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  btn.addEventListener('click', function () {
    if (app.open) closePanel()
    else openPanel()
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && app.open) closePanel()
  })

  render()
})()
