const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const pricing={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/membership-pricing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:pricing});
module.exports=function(n){
 if(n.endsWith('/membership-pricing'))return pricing;
 if(n.endsWith('/membership-fees'))return {getFees:async()=>({settings:pricing.defaultFees,version:1}),readRenewalFee:()=>pricing.feeQuote(pricing.defaultFees,'renewal'),renewalPricingReady:async()=>{}};
};
