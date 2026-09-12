<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '../i18n.js'
import { copyText, getConfig } from '../api.js'
import PwEye from './PwEye.vue'

/**
 * 发布确认框：
 *  组1 阅后即焚 + 有效期 ─ 分隔线 ─ 组2 查看密码(可选≥4) ─ 分隔线 ─ 组3 管理密码(必填≥8)+再次确认+权限注释
 *  确认 → App 调 API → 返回链接自动复制到剪贴板 → 本组件切成功态。
 *  若服务端配置了 Turnstile（/api/config 返回站点密钥），发布前需通过人机验证。
 */
const props = defineProps({
  loading: { type: Boolean, default: false },
  serverError: { type: String, default: '' },
  publishedUrl: { type: String, default: '' },
  publishedExpiresAt: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'confirm'])

const burn = ref(false)
const expiry = ref('30d')
const viewPw = ref('')
const managePw = ref('')
const managePw2 = ref('')
const copied = ref(null) // null=未尝试 true/false
const showPw = ref(false)
const showViewPw = ref(false)
// Edge Shield 人机验证（服务端配置密钥时启用）——页内执行、无 iframe、无 Cookie，
// 兼容鸿蒙 ArkWeb 等国产内核（Turnstile 在其上 600010：跨源挑战 iframe 无法执行）
const shieldSiteKey = ref(null)
const shieldToken = ref('')
const shieldEl = ref(null)
const shieldResolve = ref(null)
const shieldReject = ref(null)
const shieldBusy = ref(false)
const shieldError = ref('')

/** 接入 widget：先插入 div（data-attr 回调指向 window 具名函数），再加载脚本由其扫描渲染。
 *  每次都重挂脚本（浏览器有缓存，近乎即时），保证弹窗重开时必然重新扫描渲染。 */
async function loadShield() {
  try {
    window.__esOnToken = token => { shieldToken.value = token; shieldError.value = ''; shieldResolve.value?.(token) }
    window.__esOnError = code => { shieldToken.value = ''; shieldError.value = String(code || 'error'); shieldReject.value?.(new Error('shield-error')) }
    window.__esOnExpired = () => { shieldToken.value = ''; shieldReject.value?.(new Error('shield-expired')) }
    if (!shieldEl.value) return
    shieldEl.value.innerHTML =
      `<div class="edge-shield" data-sitekey="${shieldSiteKey.value}"` +
      ` data-callback="__esOnToken" data-error-callback="__esOnError" data-expired-callback="__esOnExpired"></div>`
    document.querySelector('script[data-edge-shield]')?.remove()
    try { delete window.edgeShield } catch { /* 忽略 */ }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://shield.edge.network/api.js'
      s.dataset.edgeShield = '1'
      s.onload = resolve
      s.onerror = () => reject(new Error('script-load'))
      document.head.appendChild(s)
    })
    shieldError.value = ''
  } catch {
    shieldError.value = 'load'
  }
}

/** 重试：清掉脚本与 widget 重挂一遍 */
function retryShield() {
  shieldError.value = ''
  shieldToken.value = ''
  loadShield()
}

// 移动端触屏/键盘遮挡缓解：弹窗内任一输入框获得焦点时，把该栏滚进 dialog 可视范围，
// 避免系统键盘把正在输入的栏(或确认按钮)盖在屏幕外。dialog 与 .overlay 均已可滚动。
const onDialogFocus = e => {
  const t = e.target
  if (!t || !(t instanceof Element)) return
  if (!t.closest('.dialog')) return
  const el = t.closest('input, select, textarea')
  if (!el) return
  requestAnimationFrame(() => {
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch { /* 忽略 */ }
  })
}

onMounted(async () => {
  document.addEventListener('focusin', onDialogFocus)
  try {
    const cfg = await getConfig()
    shieldSiteKey.value = cfg.shieldSiteKey ?? null
  } catch { /* 配置读取失败视为未启用 */ }

  if (shieldSiteKey.value) {
    // Edge Shield：打开弹窗即在页内跑 PoW + 风险评分，token 就绪后发布只需一次确认
    loadShield()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onDialogFocus)
  delete window.__esOnToken
  delete window.__esOnError
  delete window.__esOnExpired
})

const published = computed(() => !!props.publishedUrl)

watch(published, async (v) => {
  if (v && props.publishedUrl) copied.value = await copyText(props.publishedUrl)
})

const fieldError = computed(() => {
  if (managePw.value.length > 0 && managePw.value.length < 8) return t('errManageLen')
  if (viewPw.value.length > 0 && viewPw.value.length < 4) return t('errViewLen')
  if (managePw2.value && managePw2.value !== managePw.value) return t('errMismatch')
  return ''
})

const valid = computed(() => {
  if (managePw.value.length < 8) return false
  if (viewPw.value.length > 0 && viewPw.value.length < 4) return false
  if (managePw.value !== managePw2.value) return false
  return true
})

async function confirm() {
  if (!valid.value || props.loading || shieldBusy.value) return

  // token：回调产出，或兜底按 name 读 widget 的隐藏域（文档约定字段名 edge-shield-response；
  // 注意它是 name 不是 class，且 widget 可能把它挂到任意祖先/表单里，用属性选择器全局找）
  let shieldTokenVal = shieldToken.value
    || document.querySelector('[name="edge-shield-response"]')?.value
    || ''
  if (shieldSiteKey.value && !shieldTokenVal) {
    // PoW 在后台线程计算中（手机约 1-3 秒）：等待期间按钮显示「发布中…」，超时前最后一读隐藏域
    shieldBusy.value = true
    try {
      shieldTokenVal = await new Promise((resolve, reject) => {
        shieldResolve.value = resolve
        shieldReject.value = reject
        setTimeout(() => reject(new Error('shield-timeout')), 15_000)
      })
    } catch (e) {
      shieldTokenVal = document.querySelector('[name="edge-shield-response"]')?.value || ''
      if (!shieldTokenVal) {
        shieldBusy.value = false
        if (!shieldError.value) shieldError.value = e.message === 'shield-timeout' ? 'timeout' : 'fail'
        return
      }
    } finally {
      shieldBusy.value = false
    }
  }

  emit('confirm', {
    burnAfterRead: burn.value,
    expiry: expiry.value,
    viewPassword: viewPw.value,
    managePassword: managePw.value,
    shieldToken: shieldTokenVal,
  })
}

async function copyAgain() {
  copied.value = await copyText(props.publishedUrl)
}

function fmtDate(ms) {
  const d = new Date(ms)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="dialog">
      <template v-if="!published">
        <h3>{{ t('publishTitle') }}</h3>

        <!-- 组1：阅后即焚 + 有效期 -->
        <label class="burn-row">
          <input type="checkbox" v-model="burn" />
          <span class="burn-text">{{ t('burnAfterRead') }}</span>
          <span class="burn-hint">{{ t('burnHint') }}</span>
        </label>

        <div class="expiry-row">
          <span class="field-label inline">{{ t('expiry') }}</span>
          <select v-model="expiry" class="expiry-select">
            <option value="1h">{{ t('exp1h') }}</option>
            <option value="12h">{{ t('exp12h') }}</option>
            <option value="24h">{{ t('exp24h') }}</option>
            <option value="1d">{{ t('exp1d') }}</option>
            <option value="15d">{{ t('exp15d') }}</option>
            <option value="30d">{{ t('exp30d') }}</option>
            <option value="90d">{{ t('exp90d') }}</option>
            <option value="180d">{{ t('exp180d') }}</option>
            <option value="365d">{{ t('exp365d') }}</option>
          </select>
        </div>

        <hr class="divider" />

        <!-- 组2：查看密码 -->
        <label class="field-label">{{ t('viewPassword') }}</label>
        <div class="pw-wrap">
          <input v-model="viewPw" :type="showViewPw ? 'text' : 'password'" class="pw-input" :placeholder="t('pwViewPh')"
            autocomplete="new-password" spellcheck="false" />
          <PwEye :show="showViewPw" @toggle="showViewPw = !showViewPw" />
        </div>

        <hr class="divider" />

        <!-- 组3：管理密码 + 再次确认 + 权限注释 -->
        <label class="field-label">{{ t('managePassword') }}</label>
        <div class="pw-wrap">
          <input v-model="managePw" :type="showPw ? 'text' : 'password'" class="pw-input" :placeholder="t('pwEditPh')"
            autocomplete="new-password" spellcheck="false" />
          <PwEye :show="showPw" @toggle="showPw = !showPw" />
        </div>

        <label class="field-label">{{ t('managePasswordAgain') }}</label>
        <div class="pw-wrap">
          <input v-model="managePw2" :type="showPw ? 'text' : 'password'" class="pw-input" :placeholder="t('pwEditPh')"
            autocomplete="new-password" spellcheck="false" />
          <PwEye :show="showPw" @toggle="showPw = !showPw" />
        </div>

        <!-- Edge Shield 人机验证容器（服务端配置密钥后显示） -->
        <div ref="shieldEl" class="ts-box"></div>
        <div v-if="shieldError" class="ts-error">
          <p class="hint bad">{{ t('tsFailHint') }} <span class="ts-code">{{ shieldError }}</span></p>
          <button type="button" class="ts-retry" @click="retryShield">{{ t('tsRetry') }}</button>
        </div>

        <p class="edit-note">{{ t('manageNote') }}</p>

        <p v-if="fieldError" class="hint bad">{{ fieldError }}</p>
        <p v-else-if="serverError" class="hint bad">{{ serverError }}</p>

        <div class="dialog-actions">
          <button class="btn ghost" @click="emit('close')">{{ t('back') }}</button>
          <button class="btn primary" :disabled="!valid || loading || shieldBusy" @click="confirm">
            {{ loading || shieldBusy ? t('publishing') : t('confirm') }}
          </button>
        </div>
      </template>

      <!-- 成功态 -->
      <template v-else>
        <h3>{{ t('publishedTitle') }}</h3>
        <code class="link-box">{{ publishedUrl }}</code>
        <p class="hint" :class="copied === false ? 'bad' : 'ok'">
          {{ copied === false ? t('copyFailTip') : t('copiedTip') }}
        </p>
        <p v-if="publishedExpiresAt" class="edit-note">
          {{ t('validUntil').replace('{date}', fmtDate(publishedExpiresAt)) }}
        </p>
        <p class="edit-note">{{ t('publishedHint') }}</p>

        <div class="dialog-actions">
          <button class="btn ghost" @click="copyAgain">{{ t('copyLink') }}</button>
          <button class="btn primary" @click="emit('close')">{{ t('done') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>
