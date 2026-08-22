"use strict";
const fs=require("fs"),path=require("path"),babel=require("@babel/core");
const root=path.resolve(__dirname,".."),srcRoot=path.join(root,"src"),src=path.join(srcRoot,"lib"),out=path.join(root,"functions","generated","combat");
const seen=new Set();
function visit(file){
  file=path.resolve(file); if(seen.has(file))return; seen.add(file);
  const code=fs.readFileSync(file,"utf8");
  const imports=[...code.matchAll(/(?:from\s+|import\s*)["'](\.\.?\/[^"']+)["']/g)].map(m=>m[1]);
  for(const spec of imports){let dep=path.resolve(path.dirname(file),spec);if(!path.extname(dep))dep+=".js";if(dep.endsWith(".json")&&dep.startsWith(srcRoot)&&fs.existsSync(dep)){const target=path.join(out,path.relative(srcRoot,dep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(dep,target);}else if(dep.startsWith(srcRoot)&&fs.existsSync(dep))visit(dep);}
  const rel=path.relative(srcRoot,file); const target=path.join(out,rel);fs.mkdirSync(path.dirname(target),{recursive:true});
  const result=babel.transformSync(code,{babelrc:false,configFile:false,sourceType:"module",plugins:["@babel/plugin-transform-modules-commonjs"]});
  fs.writeFileSync(target,result.code+"\n");
}
fs.rmSync(out,{recursive:true,force:true});visit(path.join(src,"multiMonsterLoadoutRuntime.js"));
fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify({entry:"lib/multiMonsterLoadoutRuntime.js",files:[...seen].map(f=>path.relative(srcRoot,f)).sort()},null,2)+"\n");
