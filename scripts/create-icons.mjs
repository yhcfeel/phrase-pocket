import {writeFile,mkdir} from 'node:fs/promises';import {deflateSync} from 'node:zlib';
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]);}
await mkdir('app/icons',{recursive:true});
for(const [name,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]){
 const data=Buffer.alloc((size*3+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let coverage=0;
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
   const u=(x+(sx+.5)/4)/size,v=(y+(sy+.5)/4)/size;
   const ring=((u-.462)/.153)**2+((v-.416)/.153)**2<=1&&((u-.462)/.088)**2+((v-.416)/.088)**2>=1;
   const stem=u>.31&&u<.378&&v>.277&&v<.744;
   const dot=((u-.657)/.041)**2+((v-.644)/.041)**2<=1;
   if(ring||stem||dot)coverage++;
  }
  const alpha=coverage/16,offset=y*(size*3+1)+1+x*3;
  for(const [i,bg,fg]of [[0,37,246],[1,79,245],[2,61,239]])data[offset+i]=Math.round(bg+(fg-bg)*alpha);
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
 await writeFile('app/icons/'+name,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Created four PNG icons without external dependencies');