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
  const content = atob(data.content.replace(/\n/g, ''))
  return { data: JSON.parse(content), sha: data.sha }
}

// Write/update a file in the repo (creates a commit)
export async function writeConfigFile(path, content, sha, message) {
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
