<script setup>
import ColorMenu from './ColorMenu.vue'
import { t } from '../i18n.js'

defineProps({
  editor: { type: Object, required: true },
})
defineEmits(['open-media'])
</script>

<template>
  <div class="toolbar">
    <button class="tbtn" :title="t('undo')" @click="editor.chain().focus().undo().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6a3.5 3.5 0 0 1 0 7H7" /><path d="M6 3.5 3 6.5l3 3" /></svg>
    </button>
    <button class="tbtn" :title="t('redo')" @click="editor.chain().focus().redo().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 6.5H7a3.5 3.5 0 0 0 0 7h2" /><path d="m10 3.5l3 3-3 3" /></svg>
    </button>

    <span class="sep" />

    <button class="tbtn txt" :class="{ on: editor.isActive('heading', { level: 2 }) }" :title="t('h2')" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
    <button class="tbtn txt" :class="{ on: editor.isActive('heading', { level: 3 }) }" :title="t('h3')" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
    <button class="tbtn txt" :class="{ on: editor.isActive('paragraph') && !editor.isActive('heading') }" :title="t('paragraph')" @click="editor.chain().focus().setParagraph().run()">P</button>

    <span class="sep" />

    <button class="tbtn txt b" :class="{ on: editor.isActive('bold') }" :title="t('bold')" @click="editor.chain().focus().toggleBold().run()">B</button>
    <button class="tbtn txt i" :class="{ on: editor.isActive('italic') }" :title="t('italic')" @click="editor.chain().focus().toggleItalic().run()">I</button>
    <button class="tbtn txt u" :class="{ on: editor.isActive('underline') }" :title="t('underline')" @click="editor.chain().focus().toggleUnderline().run()">U</button>
    <button class="tbtn txt s" :class="{ on: editor.isActive('strike') }" :title="t('strike')" @click="editor.chain().focus().toggleStrike().run()">S</button>

    <ColorMenu :editor="editor" type="color" />
    <ColorMenu :editor="editor" type="bg" />

    <span class="sep" />

    <button class="tbtn" :class="{ on: editor.isActive('orderedList') }" :title="t('ol')" @click="editor.chain().focus().toggleOrderedList().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 4h7M6.5 8h7M6.5 12h7" /><text x="1" y="5.8" font-size="5.5" font-weight="600" fill="currentColor" stroke="none">1</text><text x="1" y="9.8" font-size="5.5" font-weight="600" fill="currentColor" stroke="none">2</text><text x="1" y="13.8" font-size="5.5" font-weight="600" fill="currentColor" stroke="none">3</text></svg>
    </button>
    <button class="tbtn" :class="{ on: editor.isActive('bulletList') }" :title="t('ul')" @click="editor.chain().focus().toggleBulletList().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 4h7M6.5 8h7M6.5 12h7" /><circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
    </button>
    <button class="tbtn" :class="{ on: editor.isActive('taskList') }" :title="t('task')" @click="editor.chain().focus().toggleTaskList().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h7M7 12h7" /><rect x="1.5" y="2" width="3.6" height="3.6" rx="1" /><rect x="1.5" y="10" width="3.6" height="3.6" rx="1" /><path d="m2.4 3.8.9.9 1.5-1.6" stroke-width="1.3" /></svg>
    </button>

    <span class="sep" />

    <button class="tbtn" :class="{ on: editor.isActive('blockquote') }" :title="t('quote')" @click="editor.chain().focus().toggleBlockquote().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M3.2 11.8c-1 0-1.7-.8-1.7-1.9 0-1.9 1.3-3.4 3-4l.5.9c-1 .4-1.6 1-1.7 1.8.1 0 .3-.1.5-.1.9 0 1.6.7 1.6 1.6 0 1-.8 1.7-2.2 1.7Zm6.4 0c-1 0-1.7-.8-1.7-1.9 0-1.9 1.3-3.4 3-4l.5.9c-1 .4-1.6 1-1.7 1.8.1 0 .3-.1.5-.1.9 0 1.6.7 1.6 1.6 0 1-.8 1.7-2.2 1.7Z" /></svg>
    </button>
    <button class="tbtn" :class="{ on: editor.isActive('codeBlock') }" :title="t('codeBlock')" @click="editor.chain().focus().toggleCodeBlock().run()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" /></svg>
    </button>

    <span class="sep" />

    <button class="tbtn" :title="t('insertImage')" @click="$emit('open-media', 'image')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5" /><circle cx="5.5" cy="6.5" r="1.2" /><path d="m4 12 3-3 2 2 2.5-2.5L14 11" /></svg>
    </button>
    <button class="tbtn" :title="t('insertVideo')" @click="$emit('open-media', 'video')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3.5" width="12" height="9" rx="2" /><path d="m7 6.3 3.2 1.7L7 9.7Z" fill="currentColor" stroke="none" /></svg>
    </button>
  </div>
</template>
