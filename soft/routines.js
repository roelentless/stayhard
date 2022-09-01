// A "soft" routine is a moment where the overlay is easy to remove with a single click and it disables the extension for a certain time period before it resets.
// It's up to the user to use these correctly, they can only be reused after a wait time.
//
// They have a `duration` that they remain active once activated and afterwards it takes `resetTime` before they can be activated again.
// The label is displayed in the overlay.
export default softRoutines = [
  { 
    label: "Lunch",
    duration: 30*60,
    resetTime: 20*60*60,
  },
  { 
    label: "Dinner",
    duration: 45*60,
    resetTime: 20*60*60,
  },
  { 
    label: "Relax moment",
    duration: 2*60*60,
    resetTime: 20*60*60,
  },
];