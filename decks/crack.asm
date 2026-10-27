; 15 / 5 has five answers in Z/30 (3, 9, 15, 21, 27), so the kiln refuses: CRACK fault.
        LOAD 15
        DIV 5           ; conventional: 3
        PRINT
        LOAD 15
      B DIV 7           ; 7 is a unit (7*13 ≡ 1): 15*13 = 195 ≡ 15
      B PRINT
      B DIV 5           ; 5 is not a unit -> CRACK
        HALT
