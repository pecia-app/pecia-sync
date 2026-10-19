import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlledPluginTemplate} from './windows-plugin-template.mjs';
test('selects controlled plugin directory while preserving other template fields',()=>{
  assert.equal(controlledPluginTemplate('"{{additional_plugins_path}}" {{arch}}','C:\\Build Space\\plugin'),'"C:/Build Space/plugin" {{arch}}');
});
test('rejects missing or repeated plugin markers',()=>{
  for(const template of ['', '{{additional_plugins_path}}{{additional_plugins_path}}'])assert.throws(()=>controlledPluginTemplate(template,'C:/plugin'),/Unexpected/);
});
test('rejects NSIS expansion and quoting characters in paths',()=>{
  for(const path of ['C:/$TEMP','C:/"bad','C:/bad\npath','C:/bad\rpath'])assert.throws(()=>controlledPluginTemplate('{{additional_plugins_path}}',path),/Unsafe/);
});
