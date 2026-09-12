<script setup>
import { t } from '../i18n.js'

/** 密码明文切换（眼睛按钮）：管理密码丢失即永久锁死，提供显示切换防手误打错 */
defineProps({ show: { type: Boolean, default: false } })
defineEmits(['toggle'])
</script>

<template>
  <button
    type="button"
    class="pw-eye"
    :title="show ? t('pwHide') : t('pwShow')"
    :aria-label="show ? t('pwHide') : t('pwShow')"
    tabindex="-1"
    @click.prevent="$emit('toggle')"
  >
    <svg v-if="!show" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  </button>
</template>
