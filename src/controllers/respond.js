export function sendList(res, { items, total, page, limit }) {
  res.json({
    data: items,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

export function sendCreated(req, res, item) {
  res.status(201).location(`${req.baseUrl}/${item.id}`).json({ data: item });
}
