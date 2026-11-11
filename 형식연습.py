# 형식연습.py 

strA = "파이썬은 강력해"
strB = "python is very powerful"
print(len(strA))
print(len(strB))

print(dir())

#파일명 
fName = "c:\work\test.txt"
print(fName)
print("c:\\work\\test.txt")
#LLM에게 코딩( raw string 표기법)
print(r"c:\work\text.txt")

#특수문자를 출력
print("첫번째\n두번째\n세번째\t탭문자")

#변수 넘기기
first = "길동"
last = "홍"
#format-string
print(f"{last} {first}")
#기존 코딩 
print("{0} {1}".format(last, first))

strC = "파이썬"
print(strC[0])
print(strC[1])
print(strC[2])

strB = "python is very powerful"
print(strB)
print(strB[0:6])
print(strB[:6])
print(strB[-1])
print(strB[-2])
print(strB[-3:])
#전체를 출력
print(strB[:])
#거꾸로 출력
print(strB[::-1])

#리스트 연습
colors = ["red", "blue", "green"]
print(colors)
print(type(colors))
print(len(colors))
#반복문
for item in colors:
    print(item)

#추가
colors.append("yellow")
colors.insert(1, "pink")
print(colors)
#방번호
print(colors.index("yellow"))
print(colors.count("red"))
#삭제
colors.remove("red")
print(colors)
#정렬
colors.sort()
print(colors)
#역순 정렬
colors.reverse()
print(colors)