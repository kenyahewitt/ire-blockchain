// Copy-to-clipboard for code snippets, with visible success and failure states.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]')
  if (!button) return

  const code = button.parentElement.querySelector('pre')?.innerText ?? ''
  const settle = (state, label) => {
    button.dataset.state = state
    button.textContent = label
    setTimeout(() => {
      delete button.dataset.state
      button.textContent = 'Copy'
    }, 1800)
  }

  try {
    await navigator.clipboard.writeText(code.trim())
    settle('done', 'Copied')
  } catch {
    settle('fail', 'Blocked')
  }
})
