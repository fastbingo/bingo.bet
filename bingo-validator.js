export function validateFullHouse(
  board,
  calledBalls
){

  const nums=[];

  Object.values(board)
    .forEach(col=>{

      col.forEach(v=>{

        if(v !== "FREE"){
          nums.push(v);
        }

      });

    });

  return nums.every(
    n =>
    calledBalls.includes(n)
  );
}
