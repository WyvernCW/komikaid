(function () {
  var recoveryKey = 'komikaid-module-recovery'

  window.addEventListener('error', function (event) {
    var target = event.target
    if (!(target instanceof HTMLScriptElement) || target.type !== 'module') return
    if (sessionStorage.getItem(recoveryKey)) return

    sessionStorage.setItem(recoveryKey, '1')
    var url = new URL(window.location.href)
    url.searchParams.set('app-refresh', Date.now().toString())
    window.location.replace(url.toString())
  }, true)

  window.addEventListener('load', function () {
    sessionStorage.removeItem(recoveryKey)
  }, { once: true })
})()
