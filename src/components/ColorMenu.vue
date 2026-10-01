<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '../i18n.js'

/**
 * 颜色选择弹层：type = 'color'（文字色）| 'bg'（背景色）
 * 弹层 Teleport 到 body 并用 fixed 定位，避免被工具栏 overflow 裁剪。
 */
const props = defineProps({
  editor: { type: Object, required: true },
  type: { type: String, required: true },
})

const open = ref(false)
const customHex = ref('')
const root = ref(null)
const trigger = ref(null)
const popStyle = ref({})

const palette = props.type === 'color'
  ? ['#1f2328', '#6b7280', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777']
  : ['#fef08a', '#fecaca', '#d1fae5', '#dbeafe', '#ede9fe', '#fce7f3', '#ffedd5', '#e5e7eb']

// TipTap 的编辑器状态不在 Vue 响应式系统内（v3 的 useEditor 不随事务触发重渲染），
// 而 computed 依赖只有不变的 props——不订阅事务的话 current 只求值一次便永久缓存
const tick = ref(0)
const onTx = () => { tick.value++ }
onMounted(() => props.editor.on('transaction', onTx))
onBeforeUnmount(() => props.editor.off('transaction', onTx))

const current = computed(() => {
  tick.value // 依赖事务计数：每次编辑器事务后重算
  const attrs = props.editor.getAttributes('textStyle')
  return props.type === 'color' ? attrs.color : attrs.backgroundColor
})

function toggle() {
  open.value = !open.value
  if (open.value && trigger.value) {
    const r = trigger.value.getBoundingClientRect()
    popStyle.value = {
      left: `${Math.max(8, Math.min(r.left - 6, window.innerWidth - 248))}px`,
      top: `${r.bottom + 6}px`,
    }
  }
}

function apply(hex) {
  const chain = props.editor.chain().focus()
  if (props.type === 'color') {
    hex ? chain.setColor(hex).run() : chain.unsetColor().run()
  } else {
    hex ? chain.setBackgroundColor(hex).run() : chain.unsetBackgroundColor().run()
  }
}

function onCustom() {
  const hex = customHex.value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) apply(hex)
}

function onDocClick(e) {
  if (!open.value) return
  const t = e.target
  if (root.value?.contains(t) || t.closest?.('.color-popover')) return
  open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="color-menu">
    <button
      ref="trigger"
      class="tbtn"
      :class="{ active: open }"
      :title="type === 'color' ? t('textColor') : t('bgColor')"
      @click="toggle"
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect v-if="type === 'bg'" x="2.5" y="9" width="11" height="4.5" rx="2"
          :fill="current || '#e5e7eb'" />
        <text x="8" y="8.5" text-anchor="middle" font-size="9.5" font-weight="600" fill="currentColor">A</text>
        <rect x="4" y="13" width="8" height="2" rx="1" :fill="type === 'color' ? (current || 'currentColor') : 'transparent'" />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="open" class="color-popover" :style="popStyle">
        <div class="swatches">
          <button
            v-for="c in palette" :key="c"
            class="swatch"
            :class="{ picked: current?.toLowerCase() === c }"
            :style="{ background: c }"
            :title="c"
            @click="apply(c)"
          />
        </div>
        <div class="custom-row">
          <input
            v-model="customHex"
            class="hex-input"
            placeholder="#2563eb"
            maxlength="7"
            spellcheck="false"
            @keydown.enter="onCustom"
          />
          <button class="mini-btn" :disabled="!/^#[0-9a-fA-F]{6}$/.test(customHex.trim())" @click="onCustom">{{ t('apply') }}</button>
          <button class="mini-btn" @click="apply(null)">{{ t('clear') }}</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
