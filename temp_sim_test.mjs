import { simulate } from './src/simulation.js';
const stages = [{ id:'a', name:'test', years:1, cf:0, alloc:{ us:1, bond:0, cash:0, allianztech:0, gold:0, farmland:0 }, withdrawalMode:'fixed' }];
try {
  const results = simulate(stages, 100000, 100, 0.03, { autocorr:0, crashes:[] }, 'annual', 'normal');
  console.log('ok', results.p50, results.p10);
} catch (e) {
  console.error('ERR', e && e.stack ? e.stack : e);
}
