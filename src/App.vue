<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { TextStyle, Color, BackgroundColor } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import { Video } from './editor/video.js'
import { createPasteFilter } from './editor/paste.js'
import { t, lang, blockedText, apiErrorText } from './i18n.js'
import { toggleDark } from './theme.js'
import { createPost, copyText, readPostForEdit, updatePost, deletePost } from './api.js'
import { FOOTER_LINKS, SITE_NAME } from './config/site.js'
import Toolbar from './components/Toolbar.vue'
import MediaDialog from './components/MediaDialog.vue'
import PublishDialog from './components/PublishDialog.vue'
import FloatActions from './components/FloatActions.vue'

const title = ref('')
const author = ref('')
const authorInput = ref(null)
const mediaDialog = ref(null) // 'image' | 'video' | null
const publish = ref({ open: false, loading: false, url: null, error: '', expiresAt: 0 })
const year = new Date().getFullYear()

// ---------- 编辑模式（/edit/:id） ----------
const editId = ref(location.pathname.startsWith('/edit/') ? location.pathname.split('/')[2] || null : null)
const managePw = ref('')
const gatePw = ref('')
const editGate = ref({ open: !!editId.value, error: '', loading: false })
const delConfirm = ref(false)
const updating = ref(false)
const deleting = ref(false)

async function loadForEdit() {
  if (!gatePw.value) return
  editGate.value.loading = true
  try {
    const post = await readPostForEdit(editId.value, gatePw.value)
    managePw.value = gatePw.value
    title.value = post.title
    author.value = post.author
    const doc = Array.isArray(post.json) ? { type: 'doc', content: post.json } : post.json
    editor.value?.commands.setContent(post.html || doc || '<p></p>')
    editGate.value = { open: false, error: '', loading: false }
  } catch (e) {
    editGate.value = { open: true, error: e.status === 401 ? t('wrongPw') : apiErrorText(e.message), loading: false }
  }
}

async function saveUpdate() {
  if (updating.value) return
  updating.value = true
  try {
    await updatePost(editId.value, managePw.value, {
      title: title.value,
      author: author.value,
      html: editor.value?.getHTML() ?? '',
      json: editor.value?.getJSON() ?? {},
    })
    showToast(t('updated'))
  } catch (e) {
    showToast(`${t('errPublish')}: ${apiErrorText(e.message)}`)
  } finally {
    updating.value = false
  }
}

async function doDelete() {
  if (deleting.value) return
  deleting.value = true
  try {
    await deletePost(editId.value, managePw.value)
    showToast(t('deleted'))
    setTimeout(() => location.assign('/'), 600)
  } catch (e) {
    deleting.value = false
    delConfirm.value = false
    showToast(`${t('errPublish')}: ${apiErrorText(e.message)}`)
  }
}

function goHome() {
  location.assign('/')
}

// 标题/作者栏回车跳到下一栏；isComposing 时忽略（中文输入法选词的回车）
function onTitleEnter(e) {
  if (e.isComposing) return
  e.preventDefault()
  authorInput.value?.focus()
}
function onAuthorEnter(e) {
  if (e.isComposing) return
  e.preventDefault()
  // commands.focus() 依赖 rAF 落 DOM 焦点（后台标签页会被节流），这里同步直设
  const ed = editor.value
  if (!ed) return
  ed.commands.focus()
  ed.view.dom.focus()
}

const editor = useEditor({
  content: '<p></p>',
  extensions: [
    StarterKit.configure({
      // H1 保留给页面标题（阅读页模板渲染），正文小节用 H2/H3
      heading: { levels: [2, 3] },
      link: { openOnClick: false },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color,
    BackgroundColor,
    Image.configure({ allowBase64: false }),
    Video,
    Placeholder.configure({ placeholder: () => t('startPlaceholder') }),
  ],
  // 第二层白名单：粘贴/拖拽进来的 HTML 里，不在白名单的媒体直接剔除
  editorProps: createPasteFilter({
    onBlocked: info => showToast(blockedText(info)),
  }),
})

// 切换语言时刷新占位符（Placeholder 装饰只在事务时重算）
watch(lang, () => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  ed.view.dispatch(ed.state.tr.setMeta('langRefresh', true))
})

function onInsert({ mode, result }) {
  if (mode === 'image') {
    editor.value?.chain().focus().setImage({ src: result.url }).run()
  } else {
    editor.value?.chain().focus().insertVideo({ src: result.src, embed: result.embed ?? null }).run()
  }
  // 刚插入的原子节点处于选中态，把光标移到节点之后，避免下一次插入把它整个替换掉
  const sel = editor.value?.state.selection
  if (sel?.node) editor.value.commands.setTextSelection(sel.to)
  mediaDialog.value = null
}

// ---------- 发布流程 ----------
function openPublish() {
  const ed = editor.value
  const hasText = !!ed && ed.state.doc.textContent.trim().length > 0
  const hasMedia = !!ed && !!(ed.getHTML().match(/<(img|div data-video|iframe|pre)/))
  if (!title.value.trim() && !hasText && !hasMedia) {
    showToast(t('errEmpty'))
    return
  }
  publish.value = { open: true, loading: false, url: null, error: '', expiresAt: 0 }
}

async function onPublishConfirm(payload) {
  publish.value.loading = true
  try {
    const res = await createPost({
      title: title.value,
      author: author.value,
      html: editor.value?.getHTML() ?? '',
      json: editor.value?.getJSON() ?? {},
      ...payload,
    })
    publish.value = { open: true, loading: false, url: res.url, error: '', expiresAt: res.expiresAt }
  } catch (e) {
    publish.value = { open: true, loading: false, url: null, error: `${t('errPublish')}: ${apiErrorText(e.message)}`, expiresAt: 0 }
  }
}

const toast = ref('')
let toastTimer = null
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2800)
}
onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <div class="page">
    <header class="topbar">
      <span class="brand">
        <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.8c3.4 2.3 5.4 5.3 5.4 8.7 0 3.4-2 6.4-5.4 10.2-3.4-3.8-5.4-6.8-5.4-10.2 0-3.4 2-6.4 5.4-8.7Z" />
          <circle cx="12" cy="10.6" r="1.7" />
          <path d="M12 12.3v9.4" />
        </svg>Opus</span>
      <div v-if="editId" class="edit-actions">
        <button class="btn danger" :disabled="deleting" @click="delConfirm = true">{{ t('delete') }}</button>
        <button class="btn primary" :disabled="updating" @click="saveUpdate">
          {{ updating ? t('updating') : t('update') }}
        </button>
      </div>
      <button v-else class="ghost-btn" @click="openPublish">{{ t('publish') }}</button>
    </header>

    <Toolbar v-if="editor" :editor="editor" @open-media="mediaDialog = $event" />

    <main class="paper">
      <input
        v-model="title"
        class="title"
        :placeholder="t('title')"
        spellcheck="false"
        @keydown.enter="onTitleEnter"
      />
      <input
        ref="authorInput"
        v-model="author"
        class="author"
        :placeholder="t('author')"
        spellcheck="false"
        @keydown.enter="onAuthorEnter"
      />
      <EditorContent :editor="editor" class="editor-content" />
    </main>

    <footer class="footer">
      <nav class="footer-links">
        <a v-for="l in FOOTER_LINKS" :key="l.path" :href="l.path">{{ t(l.labelKey) }}</a>
      </nav>
      <span class="copyright">© {{ year }} {{ SITE_NAME }}</span>
    </footer>

    <FloatActions />

    <MediaDialog v-if="mediaDialog" :mode="mediaDialog" @close="mediaDialog = null" @insert="onInsert" />
    <PublishDialog
      v-if="publish.open"
      :loading="publish.loading"
      :server-error="publish.error"
      :published-url="publish.url"
      :published-expires-at="publish.expiresAt"
      @close="publish.open = false"
      @confirm="onPublishConfirm"
    />

    <!-- 编辑模式：管理密码门 -->
    <div v-if="editGate.open" class="overlay">
      <div class="dialog">
        <h3>{{ t('editPwTitle') }}</h3>
        <input
          v-model="gatePw"
          type="password"
          class="pw-input"
          :placeholder="t('pwEditPh')"
          autocomplete="current-password"
          spellcheck="false"
          @keydown.enter="loadForEdit"
        />
        <p v-if="editGate.error" class="hint bad">{{ editGate.error }}</p>
        <div class="dialog-actions">
          <button class="btn ghost" @click="goHome">{{ t('back') }}</button>
          <button class="btn primary" :disabled="editGate.loading || !gatePw" @click="loadForEdit">
            {{ editGate.loading ? t('publishing') : t('confirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="delConfirm" class="overlay" @click.self="delConfirm = false">
      <div class="dialog">
        <h3>{{ t('confirmDeleteText') }}</h3>
        <div class="dialog-actions">
          <button class="btn ghost" @click="delConfirm = false">{{ t('cancel') }}</button>
          <button class="btn danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? t('publishing') : t('confirmDelete') }}
          </button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>
