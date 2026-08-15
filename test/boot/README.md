Boot fixtures: one page per way of configuring the trackpad from a page's own
markup. They are whole documents rather than harness states because what is
being tested is *when* the script runs relative to the document — a snippet in
the head runs before there is a body to mount into, and that is the case that
used to throw.

Each is loaded in a fresh page by test/run.mjs and read for the same three
things: how many trackpads ended up on the page, whether it started put away,
and where it was anchored.
