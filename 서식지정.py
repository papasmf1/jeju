#서식지정.py 

#파일에 쓰기(write text) 
f = open("sample.txt", "wt", encoding="utf-8")
f.write("이런 내용을 추가\n")
f.write("두번째\n세번째\n")
f.close()

#파일을 읽기(read text) 
f = open("sample.txt", "rt", encoding="utf-8")
content = f.read()
f.close()
print(content)

#서식지정
for x in range(1,6):
    print(x, "*", x, "=", x*x)

print("--오른쪽 정렬--")
for x in range(1,6):
    print(x, "*", x, "=", str(x*x).rjust(5))

print("--0으로 채우기--")
for x in range(1,6):
    print(x, "*", x, "=", str(x*x).zfill(5))

print("---서식문자를 지정---")
print("{0:b}".format(10))
print("{0:x}".format(10))
print("{0:,}".format(15000000))

#URL주소를 조립 
url = "http://www.naver.com/?page=" + str(1)
print(url)

#with절과 함께 사용 
with open("demo.txt", "wt", encoding="utf-8") as f:
    f.write("이런 내용을 추가\n")
    f.write("두번째\n세번째\n")

#with절과 함께 읽기 
with open("demo.txt", "rt", encoding="utf-8") as f:
    #한줄씩 읽기
    print(f.readline(), end='')
    print(f.readline(), end='')



