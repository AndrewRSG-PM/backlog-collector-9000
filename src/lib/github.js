const OWNER = 'AndrewRSG-PM'
const REPO = 'backlog-collector-9000'
const BASE = 'https://api.github.com'

function getPat() {
  return localStorage.getItem('bc9000_github_pat') || ''
}

function headers() {
  const pat = getPat()
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(pat ? { Authorization: `Bearer ${pat}` } : {}),
  }
}

// Dispatch a workflow
export async function dispatchWorkflow(workflowFile, inputs = {}) {
  const res = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return true
}

// Get recent workflow runs
export async function getWorkflowRuns(workflowFile, perPage = 5) {
  const res = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/runs?per_page=${perPage}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.workflow_runs || []
}

// Get latest run status for a workflow
export async function getLatestRun(workflowFile) {
  const runs = await getWorkflowRuns(workflowFile, 1)
  return runs[0] || null
}

// Read a file from the repo (returns parsed JSON)
export async function readConfigFile(path) {
  const res = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/contents/${path}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const raw = atob(data.content.replace(/\n/g, ''))
  const content = decodeURIComponent(escape(raw))
  return { data: JSON.parse(content), sha: data.sha }
}

// Update a GitHub Actions secret (encrypts with repo public key)
export async function updateGitHubSecret(secretName, secretValue) {
  // 1. Get repo public key
  const pkRes = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/actions/secrets/public-key`,
    { headers: headers() }
  )
  if (!pkRes.ok) throw new Error(`Could not get public key: HTTP ${pkRes.status}`)
  const { key_id, key: keyBase64 } = await pkRes.json()

  // 2. Encrypt using libsodium (crypto_box_seal)
  const sodium = await import('libsodium-wrappers')
  await sodium.default.ready
  const lib = sodium.default
  const publicKey  = lib.from_base64(keyBase64, lib.base64_variants.ORIGINAL)
  const secretBytes = lib.from_string(secretValue)
  const encrypted  = lib.crypto_box_seal(secretBytes, publicKey)
  const encryptedB64 = lib.to_base64(encrypted, lib.base64_variants.ORIGINAL)

  // 3. PUT secret
  const res = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/actions/secrets/${secretName}`,
    {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted_value: encryptedB64, key_id }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return true
}

// Write/update a file in the repo (creates a commit)
// Always fetches a fresh SHA before writing to avoid stale-cache conflicts
export async function writeConfigFile(path, content, _sha, message) {
  // Re-fetch current SHA right before writing — ignores cached sha param
  const current = await readConfigFile(path)
  const sha = current.sha

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))))
  const res = await fetch(
    `${BASE}/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message || `config: update ${path}`,
        content: encoded,
        sha,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return true
}
