/** 前端 API 封装（开发期经 Vite 代理到 8787，生产同源） */

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

/** 公开配置（人机验证站点密钥等） */
export function getConfig() {
  return request('/api/config')
}

export function createPost(payload) {
  return request('/api/posts', { method: 'POST', body: JSON.stringify(payload) })
}

export function readPostForEdit(id, managePassword) {
  return request(`/api/posts/${id}/edit-read`, { method: 'POST', body: JSON.stringify({ managePassword }) })
}

export function updatePost(id, managePassword, patch) {
  return request(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify({ managePassword, ...patch }) })
}

export function deletePost(id, managePassword) {
  return request(`/api/posts/${id}`, { method: 'DELETE', body: JSON.stringify({ managePassword }) })
}

/** 剪贴板：优先 async API，失败降级 execCommand */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
