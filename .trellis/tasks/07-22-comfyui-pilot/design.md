# Design

在 `scripts/image_pipeline/` 建立共用 client/profile/manifest runner；生成輸出與 metadata 放入 Git ignored staging。第一輪使用現有 DreamShaperXL Turbo。portrait profile 使用六份既有世界王 prompt；transparent profile 對一個測試 subject 生成後以 rembg/Pillow 輸出 RGBA WebP。所有正式路徑只讀。

