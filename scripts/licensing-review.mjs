export function validateReview(review, inputSha256) {
  if(review.status!=='approved'||!review.reviewedBy?.trim())throw Error('Licensing release review is pending. See docs/LICENSING.md.');
  for(const key of ['notices','preferredSource','platformRebuilds','bundledNativeLibraries']) {
    const path=review.evidence?.[key];
    if(typeof path!=='string'||!path.startsWith('docs/')||path.includes('..'))throw Error(`Missing repository evidence: ${key}`);
  }
  for(const [path,digest] of Object.entries(inputSha256))if(review.inputSha256?.[path]!==digest)throw Error(`License review is stale: ${path}`);
}
