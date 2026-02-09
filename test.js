const s = angular.element(document.querySelector('[data-component="timeSelector"]')).scope();
s.viewModel.calendar.eventTimes.map(e => ({ time: e.time, capacity: e.capacity, availability: e.availability }))

// (() => {
//   try {
//     const root = document.querySelector('[data-component="timeSelector"]') || document.querySelector('[ng-controller]') || document.body;
//     const s = angular.element(root).scope() || angular.element(root).isolateScope();
//     const vm = (s && (s.viewModel || s.vm)) || {};
//     const date = (vm && vm.calendar && (vm.calendar.selectedDate || vm.calendar.date || vm.selectedDate)) || (document.querySelector('#selected-eventdate') && document.querySelector('#selected-eventdate').textContent.trim()) || null;
//     const rows = ((vm && vm.calendar && vm.calendar.eventTimes) || []).map(e => ({
//       grabbedAt: new Date().toISOString(),
//       date,
//       name: e.name ?? null,
//       time: e.time ?? null,
//       capacity: (e.capacity ?? e.available ?? null),
//       availability: e.availability ?? null,
//       disabled: !!e.disabled
//     }));
//     window.WBST_INV = window.WBST_INV || [];
//     window.WBST_INV.push(...rows);
//     console.log('Appended', rows.length, 'rows. Total:', window.WBST_INV.length);
//   } catch (err) {
//     console.error('Failed to grab:', err);
//   }
// })();

