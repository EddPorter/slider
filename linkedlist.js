var LinkedList;
exports.LinkedList = LinkedList = (function() {
  function LinkedList() {
    this.head = null;
    this.count = 0;
  }
  LinkedList.prototype.Search = function(k) {
    var x;
    x = this.head;
    while ((x != null) && x.key !== k) {
      x = x.next;
    }
    return x;
  };
  LinkedList.prototype.Insert = function(k) {
    var x;
    x = {
      next: this.head,
      key: k,
      prev: null
    };
    if (this.head != null) {
      this.head.prev = x;
    }
    this.head = x;
    x.prev = null;
    ++this.count;
  };
  LinkedList.prototype.Delete = function(k) {
    var x;
    x = Search(k);
    if (!(x != null)) {
      return;
    }
    if (x.prev != null) {
      x.prev.next = x.next;
    } else {
      this.head = x.next;
    }
    if (x.next != null) {
      x.next.prev = x.prev;
    }
    --this.count;
  };
  LinkedList.prototype.Last = function() {
    var x;
    x = this.head;
    if (!(x != null)) {
      return null;
    }
    while (x.next != null) {
      x = x.next;
    }
    return x;
  };
  LinkedList.prototype.Length = function() {
    return this.count;
  };
  return LinkedList;
})();