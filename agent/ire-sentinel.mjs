#!/usr/bin/env node
/**
 * IRE Sentinel is intentionally read-only toward the blockchain. Its only
 * write capability is creating timestamped local reports in agent/reports.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const agentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(agentDirectory, "..");
const policy = JSON.parse(
  await readFile(path.join(agentDirectory, "policy.json"), "utf8"),
);
const argumentsList = process.argv.slice(2);
const aiDisabled = argumentsList.includes("--no-ai");
const watchIndex = argumentsList.indexOf("--watch");
const watchSeconds = watchIndex >= 0 ? Number(argumentsList[watchIndex + 1]) : 0;

function utcTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function checkEndpoint(name, url) {
  try {
    return { name, ok: true, value: await readJson(url) };
  } catch (error) {
    return { name, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function endpointValue(endpoints, name) {
  return endpoints.find((endpoint) => endpoint.name === name)?.value;
}

function evaluate(endpoints) {
  const status = endpointValue(endpoints, "rpc_status")?.result;
  const supply = endpointValue(endpoints, "supply")?.amount?.amount;
  const inflation = endpointValue(endpoints, "inflation")?.inflation;
  const validators = endpointValue(endpoints, "bonded_validators")?.validators ?? [];
  const checks = [
    {
      name: "rpc_available",
      pass: Boolean(status),
      expected: "local RPC responds",
      observed: status ? "responding" : "unavailable",
    },
    {
      name: "chain_id",
      pass: status?.node_info?.network === policy.chainId,
      expected: policy.chainId,
      observed: status?.node_info?.network ?? null,
    },
    {
      name: "node_synced",
      pass: status?.sync_info?.catching_up === false,
      expected: false,
      observed: status?.sync_info?.catching_up ?? null,
    },
    {
      name: "fixed_supply",
      pass: supply === policy.expectedSupply,
      expected: policy.expectedSupply,
      observed: supply ?? null,
    },
    {
      name: "zero_inflation",
      pass: inflation === "0.000000000000000000",
      expected: "0.000000000000000000",
      observed: inflation ?? null,
    },
    {
      name: "bonded_validator_present",
      pass: validators.length > 0,
      expected: "at least one bonded validator",
      observed: validators.length,
    },
  ];
  return {
    status: checks.every((check) => check.pass) ? "healthy" : "attention_required",
    checks,
    height: status?.sync_info?.latest_block_height ?? null,
    blockTime: status?.sync_info?.latest_block_time ?? null,
  };
}

function responseText(response) {
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

async function analyzeWithOpenAI(evidence) {
  if (aiDisabled) return { enabled: false, reason: "disabled by --no-ai" };
  if (!process.env.OPENAI_API_KEY) {
    return { enabled: false, reason: "OPENAI_API_KEY is not configured" };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.IRE_AGENT_MODEL || policy.model,
        store: false,
        max_output_tokens: policy.maxOutputTokens,
        instructions: [
          "You are IRE Sentinel, a defensive blockchain security analyst.",
          "Analyze only the provided public health evidence.",
          "Never request secrets, private keys, seed phrases, or API keys.",
          "Never suggest signing transactions, changing node configuration, or deploying contracts.",
          "Return a concise assessment with severity, evidence-based risks, and safe operator recommendations.",
        ].join(" "),
        input: JSON.stringify(evidence),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const body = await response.json();
    return { enabled: true, model: body.model, assessment: responseText(body) };
  } catch (error) {
    return { enabled: true, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runCheck() {
  const endpoints = await Promise.all([
    checkEndpoint("rpc_status", `${policy.rpcUrl}/status`),
    checkEndpoint("supply", `${policy.apiUrl}/cosmos/bank/v1beta1/supply/by_denom?denom=${encodeURIComponent(policy.baseDenom)}`),
    checkEndpoint("inflation", `${policy.apiUrl}/cosmos/mint/v1beta1/inflation`),
    checkEndpoint("bonded_validators", `${policy.apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`),
  ]);
  const health = evaluate(endpoints);
  const evidence = {
    generatedAt: new Date().toISOString(),
    agent: "IRE Sentinel",
    mode: "read-only chain checks; reports-only filesystem writes",
    policy: {
      chainId: policy.chainId,
      prohibitedOperations: policy.prohibitedOperations,
    },
    health,
    endpointErrors: endpoints.filter((endpoint) => !endpoint.ok).map(({ name, error }) => ({ name, error })),
  };
  const report = { ...evidence, ai: await analyzeWithOpenAI(evidence) };
  const reportDirectory = path.join(repositoryDirectory, policy.reportDirectory);
  await mkdir(reportDirectory, { recursive: true });
  const filename = `sentinel-${utcTimestamp()}.json`;
  await writeFile(path.join(reportDirectory, filename), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: health.status, report: path.join(policy.reportDirectory, filename) }));
  return report;
}

await runCheck();
if (Number.isFinite(watchSeconds) && watchSeconds > 0) {
  setInterval(() => {
    runCheck().catch((error) => console.error(error));
  }, watchSeconds * 1000);
}
