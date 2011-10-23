exports.LinkedList = class LinkedList
  constructor: () ->
    @head = null
    @count = 0

  Search: (k) ->
    x = @head
    while x? and x.key != k
      x = x.next
    x

  Insert: (k) ->
    x =
      next: @head
      key: k
      prev: null

    if @head?
      @head.prev = x
    @head = x
    x.prev = null
    ++@count
    return

  Delete: (k) ->
    x = Search k
    if not x?
      return
    if x.prev?
      x.prev.next = x.next
    else
      @head = x.next
    if x.next?
      x.next.prev = x.prev
    --@count
    return

  Last: () ->
    x = @head
    if not x?
      return null
    while x.next?
      x = x.next
    return x

  Length: () ->
    @count
