import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReview} from './licensing-review.mjs';
const hashes={'package-lock.json':'test-digest'};
const approved=()=>({status:'approved',reviewedBy:'Reviewer',inputSha256:hashes,evidence:Object.fromEntries(['notices','preferredSource','platformRebuilds','bundledNativeLibraries'].map(key=>[key,'docs/review.md']))});
test('pending review blocks publication',()=>assert.throws(()=>validateReview({status:'pending'},hashes),/pending/));
test('approval requires a named reviewer and all evidence',()=>{
  const review=approved();review.reviewedBy='';assert.throws(()=>validateReview(review,hashes),/pending/);
  for(const key of Object.keys(approved().evidence)){const review=approved();delete review.evidence[key];assert.throws(()=>validateReview(review,hashes),/evidence/);}
});
test('evidence cannot escape the repository docs',()=>{
  const review=approved();review.evidence.notices='docs/../../private';assert.throws(()=>validateReview(review,hashes),/evidence/);
});
test('changed inputs invalidate approval',()=>assert.throws(()=>validateReview(approved(),{'package-lock.json':'changed'}),/stale/));
test('complete matching review passes structural validation',()=>assert.doesNotThrow(()=>validateReview(approved(),hashes)));
