/**
 * compare two json obj
 * @param {JsonObject} a json object
 * @param {JsonObject} b json object
 * return true if each field equal.
 */
function isDeepEqual(a, b) {
  // Create arrays of property names
  var aProps = Object.getOwnPropertyNames(a);
  var bProps = Object.getOwnPropertyNames(b);
  // If number of properties is different,
  // objects are not equivalent
  if (aProps.length != bProps.length) {
    return false;
  }
  for (var i = 0; i < aProps.length; i++) {
    var propName = aProps[i];
    // If values of same property are not equal,
    // objects are not equivalent
    if (typeof a[propName] === 'object') {
      if (!isDeepEqual(a[propName], b[propName])) {
        return false
      }
    } else if (!Object.is(a[propName], b[propName])) {
      return false;
    }
  }
  // If we made it this far, objects
  // are considered equivalent
  return true;
}

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXY3456789';
/**
 * make random pair code
 * @param {Number} len length of pair code, default is 4
 */
function randomPairCode(len) {
  len = len || 4;
  let result = '';
  while (result.length < len) {
    result += CODE.charAt(Math.floor(Math.random() * CODE.length));
  }
  return result;
}

function isValidPairCode(c) {
  return CODE.includes(c);
}

module.exports = { isDeepEqual, randomPairCode, isValidPairCode, CODE }
