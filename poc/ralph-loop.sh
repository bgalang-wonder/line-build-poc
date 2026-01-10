#!/usr/bin/env bash
#
# Ralph Wiggum Loop for Line Build PoC
# =====================================
# Drives cursor-agent through POC_TASKS.json in cycles with checkpoints.
#
# Usage:
#   ./ralph-loop.sh [--dry-run] [--start-cycle N] [--model MODEL]
#
# Requirements:
#   - Cursor CLI installed with agent support (cursor agent --help)
#   - Authenticated: cursor agent status
#   - Run from repo root: 01_Projects/line-build-redesign/
#
# Safety:
#   - Each cycle commits a checkpoint (unless --dry-run)
#   - Stops on repeated failures or scope creep detection
#   - Human can Ctrl+C anytime; work is committed incrementally

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POC_DIR="$REPO_ROOT/poc/line-build-cli"
TASKS_JSON="$REPO_ROOT/docs/handoff/POC_TASKS.json"
PROGRESS_LOG="$REPO_ROOT/poc/ralph-progress.md"
MAX_RETRIES_PER_CYCLE=3
DRY_RUN=false
START_CYCLE=1
MODEL="gpt-5.2-high"
CURSOR_CMD="/usr/local/bin/cursor"
TOTAL_CYCLES=7

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --start-cycle) START_CYCLE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ==============================================================================
# Helpers
# ==============================================================================

log() {
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $*"
}

format_duration() {
  local seconds=$1
  local hours=$((seconds / 3600))
  local minutes=$(((seconds % 3600) / 60))
  local secs=$((seconds % 60))
  if [[ $hours -gt 0 ]]; then
    printf "%dh %dm %ds" "$hours" "$minutes" "$secs"
  elif [[ $minutes -gt 0 ]]; then
    printf "%dm %ds" "$minutes" "$secs"
  else
    printf "%ds" "$secs"
  fi
}

# Get cycle data by index (1-7)
get_cycle_tasks() {
  case $1 in
    1) echo "T0.1, T0.2, T1.1, T1.2" ;;
    2) echo "T2.1, T2.2" ;;
    3) echo "T3.1, T3.2" ;;
    4) echo "T4.1, T4.2, T4.3, T4.4" ;;
    5) echo "T5.1, T5.2, T5.3" ;;
    6) echo "T5.4, T5.5, T5.6" ;;
    7) echo "T6.1, T7.1" ;;
  esac
}

get_cycle_check() {
  case $1 in
    1) echo "test -f $POC_DIR/package.json && test -f $POC_DIR/scripts/lib/schema.ts && test -f $POC_DIR/scripts/lb.ts" ;;
    2) echo "test -f $POC_DIR/scripts/lib/validate.ts && test -f $POC_DIR/scripts/lib/validate.test.ts" ;;
    3) echo "test -f $POC_DIR/scripts/lib/store.ts && test -f $POC_DIR/scripts/lib/receipts.ts" ;;
    4) echo "cd $POC_DIR && npx tsx scripts/lb.ts --help" ;;
    5) echo "test -f $REPO_ROOT/apps/line-build-mvp/src/app/api/builds/route.ts && test -f $REPO_ROOT/apps/line-build-mvp/src/app/viewer/page.tsx" ;;
    6) echo "grep -qE 'dependsOn|produces|consumes' $REPO_ROOT/apps/line-build-mvp/src/components/visualization/DAGVisualization.tsx" ;;
    7) echo "test -f $POC_DIR/data/fixtures/simple-linear.json && test -f $REPO_ROOT/docs/handoff/SME_SESSION_SCRIPT.md" ;;
  esac
}

get_cycle_commit_msg() {
  case $1 in
    1) echo "POC: scaffold + schema types + Zod parsing (T0.1-T1.2)" ;;
    2) echo "POC: validator H1-H25 + composition/flow checks (T2.1-T2.2)" ;;
    3) echo "POC: atomic store + receipts + validation output (T3.1-T3.2)" ;;
    4) echo "POC: CLI commands read/write/validate/query/bulk-update (T4.1-T4.4)" ;;
    5) echo "Viewer: API routes + polling + canonical schema (T5.1-T5.3)" ;;
    6) echo "Viewer: dual graph layers + validation UX (T5.4-T5.6)" ;;
    7) echo "POC: fixtures + SME session script (T6.1-T7.1)" ;;
  esac
}

get_cycle_prompt() {
  case $1 in
    1) cat << 'PROMPT_EOF'
Complete tasks T0.1, T0.2, T1.1, T1.2 from POC_TASKS.json:

1. Create the poc/line-build-cli/ directory structure per T0.1
2. Create poc/line-build-cli/package.json with: tsx, typescript, zod, vitest (T0.2)
3. Implement canonical schema types in poc/line-build-cli/scripts/lib/schema.ts (T1.1)
4. Add Zod runtime validation with parseBuild() function (T1.2)
5. Create a minimal poc/line-build-cli/scripts/lb.ts that prints --help

Use the schema_contract from POC_TASKS.json for exact field definitions.
PROMPT_EOF
    ;;
    2) cat << 'PROMPT_EOF'
Complete tasks T2.1, T2.2 from POC_TASKS.json:

1. Implement deterministic validator in poc/line-build-cli/scripts/lib/validate.ts
2. Implement hard rules H1-H25 per docs/spec/HARD-RULES.md
3. Implement composition/flow integrity checks per POC_TASKS.json schema_contract
4. Add minimal unit tests in poc/line-build-cli/scripts/lib/validate.test.ts
5. Tests must cover: H15/H22, H8/H9 (cycles), external_build declared, artifact refs

Validator output must match validation_output_contract in POC_TASKS.json.
PROMPT_EOF
    ;;
    3) cat << 'PROMPT_EOF'
Complete tasks T3.1, T3.2 from POC_TASKS.json:

1. Implement file store in poc/line-build-cli/scripts/lib/store.ts
   - readBuild(buildId), writeBuild(build), listBuilds()
   - Use atomic write pattern (write temp then rename)
2. Implement receipts in poc/line-build-cli/scripts/lib/receipts.ts
3. Implement validation output writer in poc/line-build-cli/scripts/lib/validationOutput.ts
   - Writes to poc/line-build-cli/data/validation/<buildId>.latest.json
   - Schema must match validation_output_contract in POC_TASKS.json

Data paths are defined in POC_TASKS.json shared_conventions.paths.
PROMPT_EOF
    ;;
    4) cat << 'PROMPT_EOF'
Complete tasks T4.1-T4.4 from POC_TASKS.json:

1. Implement CLI commands in poc/line-build-cli/scripts/lb.ts:
   - read <buildId>
   - write (stdin)
   - validate <buildId>
   - list
   - search --equipment=<id> --action=<family>
   - query (per dsl_contract in POC_TASKS.json)
   - bulk-update (--dry-run default, --apply to write)
   - search-notes (regex over instruction/notes)

2. All commands must support --json flag
3. Use exit codes per POC_TASKS.json cli_output.exit_codes
4. bulk-update must revalidate and update validation.latest.json
5. Implement query DSL per dsl_contract (field whitelist, operators)
PROMPT_EOF
    ;;
    5) cat << 'PROMPT_EOF'
Complete tasks T5.1-T5.3 from POC_TASKS.json:

1. Add API routes in apps/line-build-mvp/:
   - GET /api/builds -> list from poc/line-build-cli/data/line-builds/
   - GET /api/builds/[buildId] -> build JSON
   - GET /api/validation/[buildId] -> validation.latest.json

2. Use viewer_data_root_strategy from POC_TASKS.json:
   - env var LINE_BUILD_POC_DATA_DIR with fallback ../../poc/line-build-cli/data

3. Create apps/line-build-mvp/src/app/viewer/page.tsx:
   - Poll /api/builds every 1-2 seconds
   - Refetch build when updatedAt changes

4. Refactor DAGVisualization to use canonical BenchTopLineBuild/Step (not legacy WorkUnit)
   - Use action.family enum from schema_contract
PROMPT_EOF
    ;;
    6) cat << 'PROMPT_EOF'
Complete tasks T5.4-T5.6 from POC_TASKS.json:

1. Add dual edge layers to DAGVisualization:
   - Work edges: from step.dependsOn (gray + arrowhead)
   - Flow edges: from produces -> consumes (teal/blue + arrowhead)
   - Synthetic node for external_build sources

2. Add toggle UI: Show Work Edges / Show Flow Edges

3. Add dagre layout based on work edges (T5.5)

4. Add validation visualization (T5.6):
   - Fetch /api/validation/[buildId]
   - Red outline on nodes with hard errors
   - Inspector panel showing step details + validation messages

Viewer must NOT recompute validation; only read CLI output.
PROMPT_EOF
    ;;
    7) cat << 'PROMPT_EOF'
Complete tasks T6.1, T7.1 from POC_TASKS.json:

1. Create fixture builds in poc/line-build-cli/data/fixtures/:
   - simple-linear.json (basic sequential steps)
   - parallel-join.json (produces/consumes join)
   - external-consume.json (requiresBuilds + external_build consume)
   - cycle-error.json (should fail H9)

2. Add lb validate-fixtures command

3. Create docs/handoff/SME_SESSION_SCRIPT.md with:
   - Step-by-step session guide
   - Exact CLI commands to run
   - What to observe in viewer
   - Bulk update demo steps
PROMPT_EOF
    ;;
  esac
}

# Runtime tracking (indexed arrays work in bash 3.2)
CYCLE_STATUS_1="pending"
CYCLE_STATUS_2="pending"
CYCLE_STATUS_3="pending"
CYCLE_STATUS_4="pending"
CYCLE_STATUS_5="pending"
CYCLE_STATUS_6="pending"
CYCLE_STATUS_7="pending"

CYCLE_STARTED_1=""
CYCLE_STARTED_2=""
CYCLE_STARTED_3=""
CYCLE_STARTED_4=""
CYCLE_STARTED_5=""
CYCLE_STARTED_6=""
CYCLE_STARTED_7=""

CYCLE_ENDED_1=""
CYCLE_ENDED_2=""
CYCLE_ENDED_3=""
CYCLE_ENDED_4=""
CYCLE_ENDED_5=""
CYCLE_ENDED_6=""
CYCLE_ENDED_7=""

CYCLE_DURATION_1=""
CYCLE_DURATION_2=""
CYCLE_DURATION_3=""
CYCLE_DURATION_4=""
CYCLE_DURATION_5=""
CYCLE_DURATION_6=""
CYCLE_DURATION_7=""

get_cycle_status() { eval echo "\$CYCLE_STATUS_$1"; }
set_cycle_status() { eval "CYCLE_STATUS_$1=\"$2\""; }
get_cycle_started() { eval echo "\$CYCLE_STARTED_$1"; }
set_cycle_started() { eval "CYCLE_STARTED_$1=\"$2\""; }
get_cycle_ended() { eval echo "\$CYCLE_ENDED_$1"; }
set_cycle_ended() { eval "CYCLE_ENDED_$1=\"$2\""; }
get_cycle_duration() { eval echo "\$CYCLE_DURATION_$1"; }
set_cycle_duration() { eval "CYCLE_DURATION_$1=\"$2\""; }

print_progress() {
  echo ""
  echo "+---------+----------+---------------------+---------------------+----------+"
  echo "| Cycle   | Status   | Started             | Ended               | Duration |"
  echo "+---------+----------+---------------------+---------------------+----------+"
  for i in $(seq 1 "$TOTAL_CYCLES"); do
    local status
    local started
    local ended
    local duration
    status=$(get_cycle_status "$i")
    started=$(get_cycle_started "$i")
    ended=$(get_cycle_ended "$i")
    duration=$(get_cycle_duration "$i")
    
    [[ -z "$status" ]] && status="pending"
    [[ -z "$started" ]] && started="--"
    [[ -z "$ended" ]] && ended="--"
    [[ -z "$duration" ]] && duration="--"
    
    local status_display
    case "$status" in
      done)    status_display="done    " ;;
      failed)  status_display="fail    " ;;
      running) status_display="running " ;;
      *)       status_display="pending " ;;
    esac
    
    printf "| Cycle %d | %-8s | %-19s | %-19s | %8s |\n" \
      "$i" "$status_display" "$started" "$ended" "$duration"
  done
  echo "+---------+----------+---------------------+---------------------+----------+"
  echo ""
}

print_cycle_summary() {
  local cycle="$1"
  local output_file="$2"
  local status="$3"
  local tasks
  local duration
  tasks=$(get_cycle_tasks "$cycle")
  duration=$(get_cycle_duration "$cycle")
  
  echo ""
  echo "=============================================================================="
  echo "CYCLE $cycle SUMMARY"
  echo "=============================================================================="
  echo ""
  echo "Tasks: $tasks"
  echo "Status: $status"
  echo "Duration: $duration"
  echo ""
  
  if [[ -f "$output_file" ]]; then
    echo "Files touched:"
    grep -oE "(Created|Modified|Wrote|Writing|created|wrote).*\.(ts|tsx|json|md)" "$output_file" 2>/dev/null | head -10 | sed 's/^/  /' || true
    
    echo ""
    echo "Tasks completed:"
    grep -oE "T[0-9]+\.[0-9]+" "$output_file" 2>/dev/null | sort -u | tr '\n' ' ' || true
    echo ""
    
    local errors
    local warnings
    errors=$(grep -ci "error\|failed\|exception" "$output_file" 2>/dev/null || echo "0")
    warnings=$(grep -ci "warning\|warn" "$output_file" 2>/dev/null || echo "0")
    echo ""
    echo "Issues: $errors errors, $warnings warnings"
    
    echo ""
    echo "Agent final output:"
    echo "-------------------"
    tail -30 "$output_file" | grep -v "^$" | tail -10 | sed 's/^/  /' || true
  else
    echo "(No output file found)"
  fi
  
  echo ""
  echo "=============================================================================="
  echo ""
}

checkpoint() {
  local msg="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[DRY-RUN] Would commit: $msg"
  else
    git add -A
    git commit -m "$msg" || log "Nothing to commit"
  fi
}

log_progress() {
  local cycle="$1"
  local status="$2"
  local details="$3"
  local timestamp
  timestamp=$(date +%Y-%m-%d\ %H:%M:%S)
  
  if [[ ! -f "$PROGRESS_LOG" ]]; then
    {
      echo "# Ralph Loop Progress Log"
      echo ""
      echo "This file tracks progress across cycles. Each agent run should READ this file first"
      echo "to understand what has been completed and any issues encountered."
      echo ""
      echo "---"
      echo ""
    } > "$PROGRESS_LOG"
  fi
  
  {
    echo ""
    echo "## Cycle $cycle - $status"
    echo "**Timestamp:** $timestamp"
    echo "**Model:** $MODEL"
    echo ""
    echo "$details"
    echo ""
    echo "---"
  } >> "$PROGRESS_LOG"
}

run_cursor_agent() {
  local prompt="$1"
  local output_file="$2"
  
  log "Running cursor agent with model: $MODEL"
  log "Workspace: $REPO_ROOT"
  
  "$CURSOR_CMD" agent \
    --print \
    --output-format text \
    --force \
    --model "$MODEL" \
    --workspace "$REPO_ROOT" \
    "$prompt" \
    > "$output_file" 2>&1 || true
  
  local output_size
  output_size=$(wc -c < "$output_file" | tr -d ' ')
  log "Agent output: $output_size bytes"
  
  if grep -qi "fatal error\|unhandled exception\|ENOENT" "$output_file"; then
    log "Detected fatal error in output"
    return 1
  fi
  return 0
}

# ==============================================================================
# System prompt
# ==============================================================================

SYSTEM_PROMPT='You are implementing the Line Build PoC CLI + viewer.

BEFORE YOU START - READ THESE FILES IN ORDER:
1. poc/ralph-progress.md - Progress log from previous cycles (if exists)
2. docs/handoff/POC_TASKS.json - Task definitions, schema contracts, AND task status
   - Check meta.cycle_task_mapping to see which tasks belong to which cycle
   - Check each task status field: pending or done
   - Skip tasks already marked done
3. docs/spec/SCHEMA-REFERENCE.md - Canonical schema reference
4. docs/spec/HARD-RULES.md - Validation rules H1-H25
5. docs/spec/INVARIANTS.md - System invariants

CRITICAL RULES:
1. Follow docs/handoff/POC_TASKS.json exactly. Do not deviate.
2. Work in the poc/line-build-cli/ directory for CLI code.
3. Viewer changes go in apps/line-build-mvp/.
4. Do NOT build editing UI, embeddings, or a database.
5. Viewer reads validation from CLI output files only (no in-browser validation).
6. Use the schema contract in POC_TASKS.json as the source of truth.
7. After completing each task, state which task ID you completed.
8. If blocked by ambiguity, ask ONE clarifying question and stop.

AFTER COMPLETING TASKS:
- Update docs/handoff/POC_TASKS.json: set status done and completedAt (ISO timestamp) for each completed task
- Summarize what you implemented and any decisions made
- Note any issues, blockers, or deviations from the spec

CURRENT WORKING DIRECTORY: The repo root (01_Projects/line-build-redesign/).'

# ==============================================================================
# Main loop
# ==============================================================================

LOOP_START_TIME=$(date +%s)
LOOP_START_DISPLAY=$(date +%Y-%m-%d\ %H:%M:%S)

log "Starting Ralph Wiggum Loop for Line Build PoC"
log "Repo root: $REPO_ROOT"
log "Model: $MODEL"
log "Starting from cycle: $START_CYCLE"
log "Dry run: $DRY_RUN"

# Verify cursor agent is available
if ! "$CURSOR_CMD" agent status &>/dev/null; then
  log "ERROR: Cursor agent not authenticated. Run: cursor agent login"
  exit 1
fi
log "OK: Cursor agent authenticated"

cd "$REPO_ROOT"

# Store prompts for retry modification
CURRENT_PROMPT_1=""
CURRENT_PROMPT_2=""
CURRENT_PROMPT_3=""
CURRENT_PROMPT_4=""
CURRENT_PROMPT_5=""
CURRENT_PROMPT_6=""
CURRENT_PROMPT_7=""

get_current_prompt() { eval echo "\"\$CURRENT_PROMPT_$1\""; }
set_current_prompt() { eval "CURRENT_PROMPT_$1=\"\$2\""; }

for cycle in $(seq "$START_CYCLE" "$TOTAL_CYCLES"); do
  tasks=$(get_cycle_tasks "$cycle")
  log "=============================================="
  log "CYCLE $cycle: $tasks"
  log "=============================================="
  
  cycle_start_time=$(date +%s)
  set_cycle_started "$cycle" "$(date +%Y-%m-%d\ %H:%M:%S)"
  set_cycle_status "$cycle" "running"
  
  # Initialize prompt for this cycle
  base_prompt=$(get_cycle_prompt "$cycle")
  set_current_prompt "$cycle" "$base_prompt"
  
  retries=0
  success=false
  output_file=""
  
  while [[ $retries -lt $MAX_RETRIES_PER_CYCLE ]]; do
    retries=$((retries + 1))
    log "Attempt $retries/$MAX_RETRIES_PER_CYCLE"
    
    cycle_prompt=$(get_current_prompt "$cycle")
    full_prompt="$SYSTEM_PROMPT

---

$cycle_prompt"
    
    output_file="/tmp/ralph-cycle-$cycle-attempt-$retries.txt"
    
    check_cmd=$(get_cycle_check "$cycle")
    
    if run_cursor_agent "$full_prompt" "$output_file"; then
      if eval "$check_cmd"; then
        log "OK: Cycle $cycle acceptance checks passed"
        success=true
        break
      else
        log "WARN: Acceptance checks failed, will retry"
      fi
    else
      log "WARN: Agent reported errors, will retry"
    fi
    
    if [[ $retries -lt $MAX_RETRIES_PER_CYCLE ]]; then
      log "Injecting correction prompt..."
      current=$(get_current_prompt "$cycle")
      correction="

---
CORRECTION: Previous attempt did not pass acceptance checks.
Check: $check_cmd
Fix only what is needed. Do not refactor unrelated code.
"
      set_current_prompt "$cycle" "$current$correction"
    fi
  done
  
  cycle_end_time=$(date +%s)
  set_cycle_ended "$cycle" "$(date +%Y-%m-%d\ %H:%M:%S)"
  cycle_duration=$((cycle_end_time - cycle_start_time))
  set_cycle_duration "$cycle" "$(format_duration "$cycle_duration")"
  
  if [[ "$success" == "true" ]]; then
    set_cycle_status "$cycle" "done"
    
    summary=""
    if [[ -f "$output_file" ]]; then
      summary=$(tail -100 "$output_file" | head -50)
    fi
    
    cycle_tasks_val=$(get_cycle_tasks "$cycle")
    cycle_checks_val=$(get_cycle_check "$cycle")
    cycle_duration_val=$(get_cycle_duration "$cycle")
    completed_details="**Tasks:** $cycle_tasks_val

**Acceptance check:** $cycle_checks_val

**Duration:** $cycle_duration_val

**Agent output excerpt:**
$summary"
    
    commit_msg=$(get_cycle_commit_msg "$cycle")
    log_progress "$cycle" "COMPLETED" "$completed_details"
    checkpoint "$commit_msg"
    log "OK: Cycle $cycle complete ($cycle_duration_val)"
    
    print_cycle_summary "$cycle" "$output_file" "COMPLETED"
    print_progress
  else
    set_cycle_status "$cycle" "failed"
    
    error_excerpt=""
    if [[ -f "$output_file" ]]; then
      error_excerpt=$(tail -50 "$output_file")
    fi
    
    cycle_tasks_val=$(get_cycle_tasks "$cycle")
    cycle_checks_val=$(get_cycle_check "$cycle")
    cycle_duration_val=$(get_cycle_duration "$cycle")
    failed_details="**Tasks:** $cycle_tasks_val

**Acceptance check:** $cycle_checks_val

**Attempts:** $MAX_RETRIES_PER_CYCLE

**Duration:** $cycle_duration_val

**Last error excerpt:**
$error_excerpt"
    
    log_progress "$cycle" "FAILED" "$failed_details"
    
    log "ERROR: Cycle $cycle failed after $MAX_RETRIES_PER_CYCLE attempts ($cycle_duration_val)"
    log "Stopping loop. Review output in /tmp/ralph-cycle-$cycle-*.txt"
    log "Progress logged to: $PROGRESS_LOG"
    
    print_cycle_summary "$cycle" "$output_file" "FAILED"
    print_progress
    exit 1
  fi
done

LOOP_END_TIME=$(date +%s)
LOOP_DURATION=$((LOOP_END_TIME - LOOP_START_TIME))
LOOP_DURATION_DISPLAY=$(format_duration "$LOOP_DURATION")

all_completed_details="All 7 cycles completed successfully.

**Total duration:** $LOOP_DURATION_DISPLAY"

log_progress "ALL" "COMPLETED" "$all_completed_details"

log "=============================================="
log "All cycles complete!"
log "=============================================="
log ""
log "Total time: $LOOP_DURATION_DISPLAY (started $LOOP_START_DISPLAY)"
log ""

print_progress

log "Progress log: $PROGRESS_LOG"
log ""
log "Next steps:"
log "  1. Run: cd $POC_DIR && npx tsx scripts/lb.ts --help"
log "  2. Run: cd $REPO_ROOT/apps/line-build-mvp && npm run dev"
log "  3. Open: http://localhost:3000/viewer"
log "  4. Follow: docs/handoff/SME_SESSION_SCRIPT.md"
