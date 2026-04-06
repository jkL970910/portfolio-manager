import { getPortfolioSecurityDetailView } from "./lib/backend/services";

async function main() {
  const result = await getPortfolioSecurityDetailView("87721956-40e1-42d2-b477-3cb5ef447b7b", "NVDA");
  console.log(JSON.stringify(result.data.data?.performance?.slice(0, 20), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
