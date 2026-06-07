let _set = null
let _id  = 0

function _add(type, msg, dur) {
  if (!_set) return
  const id = ++_id
  _set(p => [...p, { id, type, msg }])
  setTimeout(() => _set(p => p.filter(t => t.id !== id)), dur)
}

export const toast = {
  success: (msg, dur = 3500) => _add('success', msg, dur),
  error:   (msg, dur = 5500) => _add('error',   msg, dur),
  warning: (msg, dur = 4500) => _add('warning', msg, dur),
  info:    (msg, dur = 3500) => _add('info',    msg, dur),
  _register: fn => { _set = fn },
}
