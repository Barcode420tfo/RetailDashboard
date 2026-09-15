import test from 'node:test';
import assert from 'node:assert/strict';
import {validPassword} from '../server/routes/account-lifecycle.js';
test('passwords require four characters and a capital letter, within bcrypt byte limit',()=>{
 for(const p of [null,'Abc','abcd','1234','a'.repeat(12)])assert.equal(validPassword(p),false);
 for(const p of ['Abcd','Ab12','ABCD','A'+'a'.repeat(71),'A'+'é'.repeat(35)])assert.equal(validPassword(p),true);
 for(const p of ['A'+'a'.repeat(72),'A'+'é'.repeat(36)])assert.equal(validPassword(p),false);
});
