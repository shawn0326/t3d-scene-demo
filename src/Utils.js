export function isNight(time) {
  return time < 6 || time > 18;
}

let _isPC = null;
export function isPC() {
  if (_isPC === null) {
    const userAgentInfo = navigator.userAgent;
    const Agents = ['Android', 'iPhone', 'SymbianOS', 'Windows Phone', 'iPad', 'iPod'];
    _isPC = true;
    for (let v = 0; v < Agents.length; v++) {
      if (userAgentInfo.indexOf(Agents[v]) > 0) {
        _isPC = false;
        break;
      }
    }
  }
  return _isPC;
}

export function mix(x, y, r) {
  return x * (1 - r) + y * r;
}
