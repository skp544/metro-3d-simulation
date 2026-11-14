(async () => {
  const wait = () => new Promise(r => setTimeout(r, 180));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  [...document.querySelectorAll('button')].find(b => /^Places\s*35/.test(b.textContent)).click();
  await wait();
  const select = document.querySelector('select[aria-label="Place area"]');
  assert(select, 'area control missing');
  const root = select.closest('label').parentElement.parentElement;
  const category = name => [...root.querySelectorAll('[aria-label="Filter places"] button')].find(b => b.textContent.startsWith(name));
  const results = {};
  for (const [area, count] of [['Delhi',24],['Noida',4],['Ghaziabad',4],['Meerut',3]]) {
    select.value = area; select.dispatchEvent(new Event('change', {bubbles:true})); await wait();
    category('All').click(); await wait();
    const rows = [...root.querySelectorAll('ul > li')];
    assert(rows.length === count, `${area}: expected ${count}, got ${rows.length}`);
    results[area] = rows.map(r => r.textContent);
    if (area !== 'Delhi') {
      category('Parks').click(); await wait();
      assert(root.querySelectorAll('ul > li').length === 1, `${area}: park filter`);
    }
  }
  select.value = 'Noida'; select.dispatchEvent(new Event('change', {bubbles:true})); await wait();
  category('Zoo').click(); await wait();
  assert(root.textContent.includes('No places in this category and area.'), 'empty state missing');
  category('All').click(); await wait();
  const input = document.querySelector('input[aria-label="Search stations and places"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  for (const [query, name] of [['GIP','The Great India Place'],['Hindon City Forest','City Forest'],['Kali Paltan','Augharnath Temple'],['Company Garden','Gandhi Bagh']]) {
    input.focus(); setter.call(input,query); input.dispatchEvent(new Event('input',{bubbles:true})); await wait();
    const list = document.querySelector('#station-search-results');
    assert(list?.textContent.includes(name), `search alias: ${query}`);
    [...list.querySelectorAll('button')].find(b=>b.textContent.includes(name)).click(); await wait();
    assert([...document.querySelectorAll('aside')].some(a=>a.getAttribute('aria-label')?.includes(name)), `selection: ${query}`);
  }
  results.aliases = 'GIP, Hindon City Forest, Kali Paltan, Company Garden: search and selection passed';
  return results;
})()
