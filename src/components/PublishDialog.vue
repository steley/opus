<script setup>
import { computed, ref, watch } from 'vue'
import { t } from '../i18n.js'
import { copyText } from '../api.js'

/**
 * 发布确认框：
 *  组1 阅后即焚 + 有效期 ─ 分隔线 ─ 组2 查看密码(可选≥4) ─ 分隔线 ─ 组3 管理密码(必填≥8)+再次确认+权限注释
 *  确认 → App 调 API → 返回链接自动复制到剪贴板 → 本组件切成功态。
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

const valid = computed(() =>
  managePw.value.length >= 8 &&
  (viewPw.value.length === 0 || viewPw.value.length >= 4) &&
  managePw.value === managePw2.value
)

function confirm() {
  if (!valid.value || props.loading) return
  emit('confirm', {
    burnAfterRead: burn.value,
    expiry: expiry.value,
    viewPassword: viewPw.value,
    managePassword: managePw.value,
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
  <div class="overlay" @click.self="emit('close')">
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
        <input v-model="viewPw" type="password" class="pw-input" :placeholder="t('pwViewPh')"
          autocomplete="new-password" spellcheck="false" />

        <hr class="divider" />

        <!-- 组3：管理密码 + 再次确认 + 权限注释 -->
        <label class="field-label">{{ t('managePassword') }}</label>
        <input v-model="managePw" type="password" class="pw-input" :placeholder="t('pwEditPh')"
          autocomplete="new-password" spellcheck="false" />

        <label class="field-label">{{ t('managePasswordAgain') }}</label>
        <input v-model="managePw2" type="password" class="pw-input" :placeholder="t('pwEditPh')"
          autocomplete="new-password" spellcheck="false" />

        <p class="edit-note">{{ t('manageNote') }}</p>

        <p v-if="fieldError" class="hint bad">{{ fieldError }}</p>
        <p v-else-if="serverError" class="hint bad">{{ serverError }}</p>

        <div class="dialog-actions">
          <button class="btn ghost" @click="emit('close')">{{ t('back') }}</button>
          <button class="btn primary" :disabled="!valid || loading" @click="confirm">
            {{ loading ? t('publishing') : t('confirm') }}
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
