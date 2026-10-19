export function controlledPluginTemplate(template, pluginPath) {
  const marker='{{additional_plugins_path}}';
  if(template.split(marker).length!==2)throw Error('Unexpected upstream plugin template');
  const path=pluginPath.replaceAll('\\','/');
  if(/["$\r\n]/.test(path))throw Error('Unsafe NSIS plugin path');
  return template.replace(marker,path);
}
