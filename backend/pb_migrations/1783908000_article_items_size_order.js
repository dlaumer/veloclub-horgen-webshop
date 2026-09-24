/// <reference path="../pb_data/types.d.ts" />
// Migration: re-backfills article_items.sort_order (added in
// 1783907000_article_items_sort_order.js) using actual clothing-size logic
// instead of plain alphabetical order.
//
// Alphabetical sorting put "3XL" before "L" and "XL" before "XS" (string
// comparison has no idea "3XL" is bigger than "L"), giving 3XL, L, M, S,
// XL, XS, XXL, XXS - not what anyone wants. This computes a real numeric
// rank per size (XXS=-2, XS=-1, S=0, M=1, L=2, XL=3, XXL=4, 3XL=5, 4XL=6,
// ...) and sorts by that instead, giving XXS, XS, S, M, L, XL, XXL, 3XL,
// 4XL, ... Sizes that don't match this pattern at all (e.g. numeric shoe
// sizes, "One Size") fall back to numeric or alphabetical sorting among
// themselves and are placed after the recognized clothing sizes.
//
// This only touches the sort_order column - doesn't create/remove
// anything, so nothing needs to change in pb_hooks/veloclub.pb.js or the
// frontend beyond this one-time reshuffle.

migrate((app) => {
  function rankOf(raw) {
    const s = String(raw || "").trim().toUpperCase()
    if (s === "M") return { kind: 0, rank: 1 }
    // "nXL" notation (e.g. "3XL", "4XL") - the digit directly IS the X
    // count, so it must not also be added to the literal "X" already
    // inside "XL" below (that was an earlier bug here: "3XL" parsed as
    // digitCount=3 PLUS the one X in "XL" = 4, one too many).
    let m = s.match(/^(\d+)X(L)$/)
    if (m) {
      return { kind: 0, rank: 2 + parseInt(m[1], 10) }
    }
    // Plain repeated-X notation: "S"/"L", "XS"/"XL", "XXS"/"XXL", ...
    m = s.match(/^(X*)(S|L)$/)
    if (m) {
      const count = m[1].length
      const rank = m[2] === "S" ? -count : 2 + count
      return { kind: 0, rank: rank }
    }
    if (/^\d+(\.\d+)?$/.test(s)) {
      return { kind: 1, rank: parseFloat(s) }
    }
    return { kind: 2, rank: null }
  }

  const byArticle = {}
  for (const it of app.findAllRecords("article_items")) {
    const aid = it.get("article")
    if (!byArticle[aid]) byArticle[aid] = []
    byArticle[aid].push(it)
  }
  for (const aid in byArticle) {
    const items = byArticle[aid]
    items.sort((a, b) => {
      const ra = rankOf(a.get("size"))
      const rb = rankOf(b.get("size"))
      if (ra.kind !== rb.kind) return ra.kind - rb.kind
      if (ra.rank !== null && rb.rank !== null && ra.rank !== rb.rank) return ra.rank - rb.rank
      return String(a.get("size")).localeCompare(String(b.get("size")))
    })
    items.forEach((it, i) => {
      it.set("sort_order", i)
      app.save(it)
    })
  }
}, (app) => {
  // Down: no-op - the previous migration's own down already drops the
  // sort_order column entirely, which also undoes this one. Re-running
  // that alphabetical backfill here isn't worth the code.
})
