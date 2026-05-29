import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  disambiguateRoute,
  extractScoringTopic,
} from "../scripts/session-close/lib/notebook-disambiguate.mjs";

const registry = [
  {
    id: "nb-cns-1",
    title: "CNS Vault Architecture",
    watch: true,
    domain: "cns-brain",
    last_updated: null,
  },
  {
    id: "nb-learn-1",
    title: "Learning Notebook",
    watch: false,
    domain: "learning",
    last_updated: null,
  },
  {
    id: "nb-watch-2",
    title: "Second Watch Notebook",
    watch: true,
    domain: "general",
    last_updated: null,
  },
];

describe("disambiguateRoute", () => {
  it("passes through NO_ROUTE from scorer", () => {
    assert.deepEqual(
      disambiguateRoute({ status: "NO_ROUTE", matches: [] }, registry),
      {
        status: "NO_ROUTE",
        id: null,
        title: null,
        reason: "no-route",
      },
    );
  });

  it("routes a single match with single-match reason", () => {
    const scoreResult = {
      status: "OK",
      matches: [{ id: "nb-learn-1", title: "Learning Notebook", score: 0.9 }],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, registry), {
      status: "ROUTED",
      id: "nb-learn-1",
      title: "Learning Notebook",
      reason: "single-match",
    });
  });

  it("prefers the sole watch-flagged match among multi-match results", () => {
    const scoreResult = {
      status: "OK",
      matches: [
        { id: "nb-learn-1", title: "Learning Notebook", score: 0.95 },
        { id: "nb-cns-1", title: "CNS Vault Architecture", score: 0.9 },
      ],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, registry), {
      status: "ROUTED",
      id: "nb-cns-1",
      title: "CNS Vault Architecture",
      reason: "watch-preferred",
    });
  });

  it("returns top-ranked when none are watch-flagged", () => {
    const scoreResult = {
      status: "OK",
      matches: [
        { id: "nb-learn-1", title: "Learning Notebook", score: 0.95 },
        {
          id: "nb-other",
          title: "Other Notebook",
          watch: false,
          score: 0.9,
        },
      ],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, registry), {
      status: "ROUTED",
      id: "nb-learn-1",
      title: "Learning Notebook",
      reason: "top-ranked",
    });
  });

  it("returns top-ranked when multiple matches are watch-flagged", () => {
    const scoreResult = {
      status: "OK",
      matches: [
        { id: "nb-cns-1", title: "CNS Vault Architecture", score: 0.95 },
        { id: "nb-watch-2", title: "Second Watch Notebook", score: 0.9 },
      ],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, registry), {
      status: "ROUTED",
      id: "nb-cns-1",
      title: "CNS Vault Architecture",
      reason: "top-ranked",
    });
  });

  it("falls back to top-ranked when registry is null or undefined", () => {
    const scoreResult = {
      status: "OK",
      matches: [
        { id: "nb-learn-1", title: "Learning Notebook", score: 0.95 },
        { id: "nb-cns-1", title: "CNS Vault Architecture", score: 0.9 },
      ],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, null), {
      status: "ROUTED",
      id: "nb-learn-1",
      title: "Learning Notebook",
      reason: "top-ranked",
    });
    assert.deepEqual(disambiguateRoute(scoreResult, undefined), {
      status: "ROUTED",
      id: "nb-learn-1",
      title: "Learning Notebook",
      reason: "top-ranked",
    });
  });

  it("falls back to top-ranked when registry is not an array (multi-match)", () => {
    const scoreResult = {
      status: "OK",
      matches: [
        { id: "nb-learn-1", title: "Learning Notebook", score: 0.95 },
        { id: "nb-cns-1", title: "CNS Vault Architecture", score: 0.9 },
      ],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, {}), {
      status: "ROUTED",
      id: "nb-learn-1",
      title: "Learning Notebook",
      reason: "top-ranked",
    });
  });

  it("returns NO_ROUTE for malformed scoreResult", () => {
    assert.deepEqual(disambiguateRoute(null, registry), {
      status: "NO_ROUTE",
      id: null,
      title: null,
      reason: "no-route",
    });
    assert.deepEqual(disambiguateRoute({ status: "OK" }, registry), {
      status: "NO_ROUTE",
      id: null,
      title: null,
      reason: "no-route",
    });
    assert.deepEqual(disambiguateRoute({ matches: [] }, registry), {
      status: "NO_ROUTE",
      id: null,
      title: null,
      reason: "no-route",
    });
  });

  it("passes through NO_ROUTE when scorer omits matches field", () => {
    assert.deepEqual(disambiguateRoute({ status: "NO_ROUTE" }, registry), {
      status: "NO_ROUTE",
      id: null,
      title: null,
      reason: "no-route",
    });
  });

  it("uses registry title when match title differs", () => {
    const scoreResult = {
      status: "OK",
      matches: [{ id: "nb-cns-1", title: "Stale Title", score: 0.9 }],
    };
    assert.deepEqual(disambiguateRoute(scoreResult, registry), {
      status: "ROUTED",
      id: "nb-cns-1",
      title: "CNS Vault Architecture",
      reason: "single-match",
    });
  });
});

describe("extractScoringTopic", () => {
  it("joins active epic ids from the context pack", () => {
    const topic = extractScoringTopic({
      sprint: {
        active_epics: [{ id: "epic-50" }, { id: "epic-49" }],
      },
    });
    assert.equal(topic, "epic-50 epic-49");
  });

  it("falls back to recent story slug keywords", () => {
    const topic = extractScoringTopic({
      sprint: { active_epics: [] },
      recent_stories: [
        {
          basename: "50-3-conservative-notebook-scorer",
          title: "Story 50.3",
          status: "done",
        },
      ],
    });
    assert.equal(topic, "conservative notebook scorer");
  });

  it("returns empty string when contextPack has no usable fields", () => {
    assert.equal(extractScoringTopic(null), "");
    assert.equal(extractScoringTopic(undefined), "");
    assert.equal(extractScoringTopic({}), "");
    assert.equal(extractScoringTopic({ sprint: {}, recent_stories: [] }), "");
  });

  it("truncates topic to 60 characters", () => {
    const topic = extractScoringTopic({
      sprint: {
        active_epics: [
          { id: "epic-very-long-name-that-exceeds-the-sixty-character-limit" },
          { id: "epic-49" },
        ],
      },
    });
    assert.ok(topic.length > 0, "topic should be non-empty");
    assert.ok(topic.length <= 60, "topic should not exceed 60 chars");
  });
});
