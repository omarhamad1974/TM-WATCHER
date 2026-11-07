// [id, label, type, args, default, help tip]
export const DEF = {
  out: [
    ['min', 'Minimum similarity (%)', 'rng', [0, 100, 1], 60, 'Only matches scoring at or above this percentage are listed. Start near 60. Raise it to see only close look-alikes, lower it to catch weaker resemblances.'],
    ['maxRes', 'Maximum results shown', 'num', [1], 50, 'Caps how many matches are listed, best first. A saved search keeps the same number.']
  ],
  pdf: [
    ['mode', 'Take from each page', 'sel', [['largest', 'Largest embedded image'], ['all', 'All embedded images'], ['page', 'Whole page']], 'largest', 'Largest: the biggest picture on the page is the trademark (best for one logo per page). All: every picture becomes a candidate (use if a page holds several marks). Whole page: ignore embedded pictures and use the entire page (for scanned catalogues).'],
    ['scale', 'Page render quality', 'sel', [[1, 'Low (1×)'], [1.5, 'Medium (1.5×)'], [2, 'High (2×)'], [3, 'Very high (3×)']], 2, 'How sharply each page is drawn before the trademark is cropped out. Higher is sharper but slower and uses more memory. 2× is a good default.'],
    ['minImg', 'Ignore images smaller than (px)', 'rng', [0, 400, 10], 60, 'Skips small pictures such as icons, bullets or stamps. Measured in pixels at the chosen render quality.'],
    ['pFrom', 'First page', 'num', [1], 1, 'First PDF page to read.'],
    ['pTo', 'Last page (0 = all)', 'num', [0], 0, 'Last PDF page to read. 0 means read to the end.']
  ],
  pre: [
    ['N', 'Comparison resolution (px)', 'sel', [[32, '32 – fastest'], [64, '64'], [96, '96'], [128, '128 – finest']], 64, 'Size both images are shrunk to before measuring. Small is fast but coarse. Large keeps fine detail but is slower. 64 suits most logos. Catalogue images are stored at 256 px, so more than 128 adds little.'],
    ['fit', 'Resize method', 'sel', [['pad', 'Keep proportions'], ['stretch', 'Stretch to square']], 'pad', 'Keep proportions: the mark is never distorted and extra space is filled with the background colour. Stretch: forces the mark into a square, so a wide logo and a tall one can look more alike.'],
    ['crop', 'Trim background margins', 'chk', 0, true, 'Cuts away empty border around the mark so size and position on the page do not affect the score. Turn off only if position in the frame matters.'],
    ['tol', 'Background tolerance (%)', 'rng', [0, 60, 1], 12, 'How different from the background a pixel must be to count as part of the mark when trimming. Raise it for noisy or off-white scans, lower it for faint marks.'],
    ['norm', 'Normalise contrast', 'chk', 0, false, 'Stretches brightness so the darkest pixel becomes black and the lightest white. Helps compare a faded scan with a crisp file.'],
    ['thr', 'Shape threshold (0 = automatic)', 'rng', [0, 100, 1], 0, 'Brightness level that separates the mark from its background for the Shape metric. 0 picks the level automatically for each image. Set it manually only if shapes look wrong.']
  ],
  tf: [
    ['rot', 'Rotations to try', 'sel', [[0, 'None'], [90, 'Every 90°'], [45, 'Every 45°'], [30, 'Every 30°'], [15, 'Every 15°']], 0, 'Also compares turned copies of the source and keeps the best score. Finds marks that are the same design but rotated. Smaller steps find more but are much slower.'],
    ['flip', 'Also try mirrored', 'chk', 0, false, 'Also compares a left-to-right mirror image of the source. Catches reversed versions of a mark. Doubles the work.'],
    ['neg', 'Also try inverted colors', 'chk', 0, false, 'Also compares a light-on-dark version of the source. Catches a white logo on black against a black logo on white. Doubles the work.']
  ],
  met: [
    ['mix', 'Combine metrics by', 'sel', [['avg', 'Weighted average'], ['min', 'Strictest metric'], ['max', 'Best metric']], 'avg', 'Weighted average: blends all active metrics by their weights (balanced). Strictest: the final score is the lowest active metric, so a match must pass every test. Best: the highest active metric, so one strong resemblance is enough.'],
    ['w_phash', 'pHash – overall structure', 'rng', [0, 10, .5], 2, 'Perceptual hash from the image’s broad light and dark patterns. Robust to small colour, size and blur changes. Good for “same overall design”.'],
    ['w_dhash', 'dHash – gradients', 'rng', [0, 10, .5], 1, 'Difference hash: records whether brightness rises or falls across the image. Sensitive to outlines and direction of change.'],
    ['w_ahash', 'aHash – brightness layout', 'rng', [0, 10, .5], .5, 'Average hash: records which areas are lighter or darker than average. Quick and rough, so keep its weight low.'],
    ['w_ssim', 'SSIM – local similarity', 'rng', [0, 10, .5], 2, 'Structural similarity: compares small blocks for brightness, contrast and pattern, as human vision does. Strong at spotting near-identical artwork.'],
    ['w_ncc', 'Pixel correlation', 'rng', [0, 10, .5], 1, 'Measures whether bright and dark pixels line up across the two images. Strict about position, so it rewards close copies.'],
    ['w_edge', 'Edge / outline match', 'rng', [0, 10, .5], 1.5, 'Compares the outlines and strokes of the marks while ignoring fills. Good for line-art logos and different colourings of one design.'],
    ['w_shape', 'Shape overlap', 'rng', [0, 10, .5], 2, 'Turns each mark into a solid silhouette and measures how much the silhouettes overlap. Good for bold, simple marks.'],
    ['w_color', 'Color palette', 'rng', [0, 10, .5], .5, 'Compares the colours used inside the mark, ignoring the background. Set to 0 to find look-alikes regardless of colour.']
  ]
};
export const FILTER_GROUPS = ['out', 'pre', 'tf', 'met'];
