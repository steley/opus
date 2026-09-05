<script setup>
import { computed, ref, watch } from 'vue'
import { checkImageUrl, checkVideoUrl, whitelist } from '../config/whitelist.js'
import { t, mediaErrorText } from '../i18n.js'

/**
 * 插入图片/视频的 URL 弹窗：输入即校验（第一层白名单校验）。
 */
const props = defineProps({
  mode: { type: String, required: true }, // 'image' | 'video'
})
const emit = defineEmits(['close', 'insert'])

const url = ref('')
const result = computed(() => {
  const v = url.value.trim()
  if (!v) return null
  return props.mode === 'image' ? checkImageUrl(v) : checkVideoUrl(v)
})

watch(() => props.mode, () => { url.value = '' })

// 按展示名分组：同名域名（如 YouTube 的两个域）合并为一行，逗号分隔
const hostGroups = computed(() => {
  const hosts = props.mode === 'image'
    ? whitelist.imageHosts
    : [...whitelist.videoHosts, ...whitelist.embedHosts]
  const groups = []
  for (const h of hosts) {
    const name = whitelist.hostNames[h] ?? h
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.hosts.push(h)
    else groups.push({ name, hosts: [h] })
  }
  return groups
})

const hintText = computed(() => {
  if (!result.value) return ''
  if (result.value.ok) {
    return result.value.kind === 'embed'
      ? t('okEmbed').replace('{url}', result.value.embed)
      : t('okPass')
  }
  return mediaErrorText(result.value.error, props.mode)
})

function insert() {
  if (!result.value?.ok) return
  emit('insert', { mode: props.mode, result: result.value })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="dialog">
      <h3>{{ mode === 'image' ? t('insertImageTitle') : t('insertVideoTitle') }}</h3>

      <input
        v-model="url"
        class="url-input"
        :placeholder="mode === 'image' ? t('imageUrlPh') : t('videoUrlPh')"
        spellcheck="false"
        autofocus
        @keydown.enter="insert"
      />

      <p v-if="result" class="hint" :class="result.ok ? 'ok' : 'bad'">{{ hintText }}</p>

      <div class="hosts">
        <span class="hosts-label">{{ t('whitelistHosts') }}</span>
        <div class="hosts-list">
          <div v-for="g in hostGroups" :key="g.name" class="hosts-line" :title="g.hosts.join(', ')">
            <b>{{ g.name }}</b>: {{ g.hosts.join(', ') }}
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button class="btn ghost" @click="emit('close')">{{ t('cancel') }}</button>
        <button class="btn primary" :disabled="!result?.ok" @click="insert">{{ t('insert') }}</button>
      </div>
    </div>
  </div>
</template>
