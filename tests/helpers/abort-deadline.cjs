// Shared stubs for tests that drive a deadline. Both exist so a deadline case needs no real
// waiting: this machine has no timeout command, and a hanging await would stall the suite.

// A drivable timer pair. `pending` holds what is still scheduled, so a test can assert a
// deadline was cleared as well as fire one.
function fakeTimers() {
    const pending = new Map();
    let next = 1;
    return {
        pending,
        setTimeout: (fn) => { pending.set(next, fn); return next++; },
        clearTimeout: (id) => pending.delete(id),
        // Fires everything scheduled, like a clock jumping forward.
        fireAll() {
            for (const [, fn] of [...pending]) fn();
            pending.clear();
        }
    };
}

// A fetch that never settles on its own: it rejects only when the caller aborts, which is what
// a real fetch does and what a deadline is supposed to trigger. Every call is recorded so a
// test can assert the signal was passed and later aborted.
function hangingFetch(seen) {
    return (url, init) => new Promise((resolve, reject) => {
        seen.push({ url, init });
        init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
        });
    });
}

module.exports = { fakeTimers, hangingFetch };
