export function generateCard(){

  function column(
    start,
    end,
    count
  ){

    const arr=[];

    while(
      arr.length < count
    ){

      const n=
        Math.floor(
          Math.random()
          *
          (end-start+1)
        )+start;

      if(
        !arr.includes(n)
      ){
        arr.push(n);
      }

    }

    return arr.sort(
      (a,b)=>a-b
    );
  }

  return {

    B: column(1,15,5),

    I: column(16,30,5),

    N: [
      ...column(31,45,2),
      "FREE",
      ...column(31,45,2)
    ],

    G: column(46,60,5),

    O: column(61,75,5)

  };
}
