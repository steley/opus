<script setup>
import { dark, toggleDark } from '../theme.js'
import { lang, toggleLang, t } from '../i18n.js'

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="float-actions">
    <button class="fab" :title="dark ? t('light') : t('dark')" @click="toggleDark">
      <!-- 深色时显示太阳（点击切回日间），浅色时显示月亮 -->
      <svg v-if="dark" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.2v1.8M8 13v1.8M1.2 8H3M13 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.9 9.9A6.2 6.2 0 0 1 6.1 2.1 6.2 6.2 0 1 0 13.9 9.9Z" />
      </svg>
    </button>

    <button class="fab" :title="t('switchLang')" @click="toggleLang">
      {{ lang === 'zh' ? 'EN' : '中' }}
    </button>

    <button class="fab" :title="t('backTop')" @click="backToTop">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 13.5v-11M3.8 6.7 8 2.5l4.2 4.2" />
      </svg>
    </button>
  </div>
</template>
