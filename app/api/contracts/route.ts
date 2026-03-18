import { NextResponse } from "next/server";

const contracts = {
  version: "0.1.0",
  endpoints: [
    {
      path: "/api/dashboard",
      method: "GET",
      description: "Dashboard overview metrics, alerts, asset mix, and recommendation summary."
    },
    {
      path: "/api/portfolio",
      method: "GET",
      description: "Portfolio analytics, performance history, account allocation, and holdings table."
    },
    {
      path: "/api/recommendations",
      method: "GET",
      description: "Recommendation inputs, ranked priorities, notes, and confidence sections."
    },
    {
      path: "/api/spending",
      method: "GET",
      description: "Spending metrics, category summary, trend chart, and transactions."
    },
    {
      path: "/api/import",
      method: "GET",
      description: "Import steps, setup cards, and success-state definitions."
    },
    {
      path: "/api/settings/preferences",
      method: "GET",
      description: "Guided setup questions and manual configuration groups."
    }
  ]
};

export async function GET() {
  return NextResponse.json(contracts);
}
